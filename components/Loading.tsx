import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center z-50">
      <Image
        src="/logo.png"
        alt="Loading"
        width={60}
        height={60}
        className="animate-ping"
      />
    </div>
  );
}
