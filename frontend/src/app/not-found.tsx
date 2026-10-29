import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-extrabold text-violet">404</p>
      <h1 className="mt-3 text-xl font-bold text-ink">This page doesn&apos;t exist</h1>
      <p className="mt-1 text-sm text-ink-soft">Check the address, or head back to your dashboard.</p>
      <Link href="/home" className="mt-6 inline-flex h-10 items-center rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white">
        Go to Home
      </Link>
    </div>
  );
}
