import { createContext, useContext } from "react";
import type { AsideCtxShape } from "./types";

export const AsideCtx = createContext<AsideCtxShape>(null!);

export function useAsideCtx() {
  return useContext(AsideCtx);
}
