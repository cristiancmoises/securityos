import styled from "styled-components";
import { MAX_FILE_NAME_LENGTH } from "utils/constants";

const StyledRenameBox = styled.textarea.attrs({
  autocomplete: "off",
  enterKeyHint: "done",
  maxLength: MAX_FILE_NAME_LENGTH,
  rows: 1,
  spellCheck: false,
})`
  border: 1px solid ${({ theme }) => theme.colors.fileEntry.border};
  font-family: inherit;
  font-size: 11.5px;
  margin-bottom: 2px;
  max-width: ${({ theme }) => theme.sizes.fileEntry.renameWidth}px;
  min-height: 19px;
  min-width: 30px;
  overflow: hidden;
  padding: ${({ theme }) => `1px ${theme.sizes.fileEntry.renamePadding}px`};
  position: relative;
  resize: none;
  text-align: center;
  top: 2px;
  user-select: text;
  white-space: break-spaces;
  z-index: 1;

  &:focus {
    border-color: hsla(190, 100%, 62%, 90%);
    box-shadow: 0 0 0 1px hsla(190, 100%, 62%, 50%),
      0 0 8px hsla(190, 100%, 55%, 35%);
    outline: none;
  }
`;

export default StyledRenameBox;
