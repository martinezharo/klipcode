import type { WorkspaceShellProps } from "@/components/Aside/types";

import type { MobileFeedState } from "./useMobileFeedState";

/**
 * The mobile home needs exactly the shared shell surface — account controls,
 * trash entry point and the tree — and nothing the desktop aside adds on top
 * (collapse state, the keyboard-shortcuts dialog, a separate "Home" entry:
 * here the tree *is* home). Plus where the user was in it, which has to outlive
 * the home itself (see {@link useMobileFeedState}).
 */
export interface MobileHomeProps extends WorkspaceShellProps {
  feed: MobileFeedState;
}
