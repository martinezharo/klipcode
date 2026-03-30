import { Suspense } from "react";
import KlipCodeApp from "@/components/KlipCodeApp";

export default function Home() {
  return (
    <Suspense>
      <KlipCodeApp />
    </Suspense>
  );
}
