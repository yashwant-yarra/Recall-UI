import Image from "next/image";

export function Logo() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <Image src="/recall-mark.svg" alt="" width={32} height={32} className="shrink-0" />
      <span className="brand">Recall</span>
    </span>
  );
}
