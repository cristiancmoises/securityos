import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

const Result = styled.div`
  display: grid;
  gap: 6px 14px;
  grid-template-columns: max-content 1fr;

  .k {
    color: #ab9cbb;
    white-space: nowrap;
  }

  .v {
    color: #e8e2ee;
    font-family: ${({ theme }) => theme.formats.monoFont};
    word-break: break-all;
  }
`;

type Subnet = {
  broadcast: string;
  class: string;
  firstHost: string;
  lastHost: string;
  netmask: string;
  network: string;
  prefix: number;
  totalAddresses: string;
  usableHosts: string;
  wildcard: string;
};

// Convert an unsigned 32-bit integer into dotted-quad notation.
const intToIp = (value: number): string =>
  [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".");

// Determine the legacy address class from the first octet of the network.
const addressClass = (firstOctet: number): string => {
  if (firstOctet < 128) return "A";
  if (firstOctet < 192) return "B";
  if (firstOctet < 224) return "C";
  if (firstOctet < 240) return "D (multicast)";
  return "E (experimental)";
};

// Parse + validate octets (0-255) and prefix (0-32). Returns a typed error
// string instead of throwing so the UI can render it gracefully.
const compute = (ipText: string, prefixText: string): Subnet | string => {
  const ip = ipText.trim();
  const octetParts = ip.split(".");

  if (octetParts.length !== 4) {
    return "Enter a valid IPv4 address with four octets, e.g. 10.0.0.0";
  }

  const octets: number[] = [];

  for (const part of octetParts) {
    if (!/^\d{1,3}$/.test(part)) {
      return `Invalid octet "${part}" — use digits only.`;
    }

    const num = Number(part);

    if (num > 255) {
      return `Octet "${part}" is out of range (0-255).`;
    }

    octets.push(num);
  }

  const prefixTrim = prefixText.trim();

  if (!/^\d{1,2}$/.test(prefixTrim)) {
    return "Prefix must be a whole number from 0 to 32.";
  }

  const prefix = Number(prefixTrim);

  if (prefix > 32) {
    return "Prefix is out of range (0-32).";
  }

  const ipInt =
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>>
    0;

  // /0 has no set mask bits; shifting by 32 is undefined in JS, so special-case.
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcardInt = ~maskInt >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const total = 2n ** BigInt(32 - prefix);

  let firstHost: string;
  let lastHost: string;
  let usable: bigint;

  if (prefix >= 31) {
    // /31 (RFC 3021 point-to-point) and /32 have no broadcast/network split.
    firstHost = intToIp(networkInt);
    lastHost = intToIp(broadcastInt);
    usable = prefix === 32 ? 1n : 2n;
  } else {
    firstHost = intToIp((networkInt + 1) >>> 0);
    lastHost = intToIp((broadcastInt - 1) >>> 0);
    usable = total - 2n;
  }

  return {
    broadcast: prefix >= 31 ? "n/a" : intToIp(broadcastInt),
    class: addressClass(octets[0]),
    firstHost,
    lastHost,
    netmask: intToIp(maskInt),
    network: intToIp(networkInt),
    prefix,
    totalAddresses: total.toString(),
    usableHosts: usable.toString(),
    wildcard: intToIp(wildcardInt),
  };
};

const CidrCalculatorTool: FC = () => {
  const [ip, setIp] = useState("10.0.0.0");
  const [prefix, setPrefix] = useState("24");

  // Accept a combined CIDR string and split it into the two fields.
  const onCidrPaste = useCallback((raw: string) => {
    const slash = raw.indexOf("/");

    if (slash === -1) {
      setIp(raw);
      return;
    }

    setIp(raw.slice(0, slash));
    setPrefix(raw.slice(slash + 1));
  }, []);

  const result = useMemo(() => compute(ip, prefix), [ip, prefix]);
  const error = typeof result === "string" ? result : null;
  const subnet = typeof result === "string" ? null : result;

  return (
    <StyledTool>
      <h2>CIDR / Subnet Calculator</h2>
      <p className="desc">
        Bitwise IPv4 subnetting — network, broadcast, masks, host range, and
        address class.
      </p>

      <div>
        <label htmlFor="cidr-ip">IPv4 address (or paste full CIDR)</label>
        <input
          id="cidr-ip"
          onChange={(e) => onCidrPaste(e.target.value)}
          placeholder="10.0.0.0  or  10.0.0.0/24"
          spellCheck={false}
          type="text"
          value={ip}
        />
      </div>

      <div>
        <label htmlFor="cidr-prefix">Prefix length (0-32)</label>
        <input
          id="cidr-prefix"
          max={32}
          min={0}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="24"
          type="number"
          value={prefix}
        />
      </div>

      {error ? (
        <p className="error">{error}</p>
      ) : (
        subnet && (
          <pre className="output">
            <Result>
              <span className="k">CIDR</span>
              <span className="v">
                {subnet.network}/{subnet.prefix}
              </span>
              <span className="k">Network address</span>
              <span className="v">{subnet.network}</span>
              <span className="k">Broadcast</span>
              <span className="v">{subnet.broadcast}</span>
              <span className="k">Netmask</span>
              <span className="v">{subnet.netmask}</span>
              <span className="k">Wildcard mask</span>
              <span className="v">{subnet.wildcard}</span>
              <span className="k">First usable host</span>
              <span className="v">{subnet.firstHost}</span>
              <span className="k">Last usable host</span>
              <span className="v">{subnet.lastHost}</span>
              <span className="k">Total addresses</span>
              <span className="v">{subnet.totalAddresses}</span>
              <span className="k">Usable hosts</span>
              <span className="v">{subnet.usableHosts}</span>
              <span className="k">Address class</span>
              <span className="v">{subnet.class}</span>
            </Result>
          </pre>
        )
      )}
    </StyledTool>
  );
};

export default CidrCalculatorTool;
