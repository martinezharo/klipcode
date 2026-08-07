import { useEffect, useRef } from "react";

/** Keep a ref synchronized without mutating it during render. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
