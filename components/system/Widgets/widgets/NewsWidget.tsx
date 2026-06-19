import {
  MAX_NEWS_HEADLINES,
  NEWS_REFRESH_MS,
  PROXY_PATH,
} from "components/system/Widgets/constants";
import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";
import { useEffect, useState } from "react";

type NewsWidgetProps = WidgetProps & {
  feedUrl: string;
};

type Headline = {
  link: string;
  title: string;
};

/** Pull the first non-empty text from a list of child tag names. */
const firstText = (item: Element, tags: string[]): string => {
  for (const tag of tags) {
    const node = item.getElementsByTagName(tag)[0];
    const text = node?.textContent?.trim();

    if (text) return text;
  }

  return "";
};

/** Atom links live in <link href="..."/>; RSS in <link>text</link>. */
const firstLink = (item: Element): string => {
  const links = item.getElementsByTagName("link");

  for (const link of Array.from(links)) {
    const href = link.getAttribute("href")?.trim() || link.textContent?.trim();

    if (href) return href;
  }

  return "";
};

const parseFeed = (xml: string): Headline[] => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid feed XML");
  }

  // RSS uses <item>, Atom uses <entry>.
  const items = Array.from(doc.getElementsByTagName("item")).concat(
    Array.from(doc.getElementsByTagName("entry"))
  );

  return items
    .map((item) => ({
      link: firstLink(item),
      title: firstText(item, ["title"]),
    }))
    .filter((headline) => headline.title)
    .slice(0, MAX_NEWS_HEADLINES);
};

const NewsWidget: FC<NewsWidgetProps> = ({ feedUrl, ...props }) => {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let interval = 0;

    const fetchNews = async (): Promise<void> => {
      try {
        // Same-origin proxy fetches the (likely CORS-blocked) feed over Tor.
        const response = await fetch(
          `${PROXY_PATH}${encodeURIComponent(feedUrl)}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const parsed = parseFeed(await response.text());

        setHeadlines(parsed);
        setError(parsed.length === 0 ? "No headlines found" : "");
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError("Couldn't load feed");
        if (caught instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("News widget:", caught.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    setLoading(true);
    fetchNews();
    interval = window.setInterval(fetchNews, NEWS_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [feedUrl]);

  return (
    <WidgetCard title="News" {...props}>
      {loading && headlines.length === 0 ? (
        <div className="widget-status">Loading…</div>
      ) : error && headlines.length === 0 ? (
        <div className="widget-status widget-error">{error}</div>
      ) : (
        <ul className="news-list">
          {headlines.map((headline) => (
            <li key={`${headline.title}:${headline.link}`}>
              {headline.link ? (
                <a
                  href={headline.link}
                  rel="noopener noreferrer"
                  target="_blank"
                  title={headline.title}
                >
                  {headline.title}
                </a>
              ) : (
                <span title={headline.title}>{headline.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
};

export default NewsWidget;
