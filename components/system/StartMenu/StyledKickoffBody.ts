import styled from "styled-components";

/**
 * Positioning context for the Kickoff body: the category rail (Sidebar, absolutely
 * positioned) and the scrollable app list (FileManager) live here, sandwiched between
 * the header and footer strips. `flex: 1` lets it own the remaining height so the app
 * list keeps scrolling intact.
 */
const StyledKickoffBody = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
`;

export default StyledKickoffBody;
