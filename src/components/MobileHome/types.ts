import type { WorkspaceShellProps } from "@/components/Aside/types";

/**
 * The mobile home needs exactly the shared shell surface — account controls,
 * trash entry point and the tree — and nothing the desktop aside adds on top
 * (collapse state, the keyboard-shortcuts dialog, a separate "Home" entry:
 * here the tree *is* home).
 */
export type MobileHomeProps = WorkspaceShellProps;
