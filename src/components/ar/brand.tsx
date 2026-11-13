import { Link } from "@tanstack/react-router";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="seal grid size-9 place-items-center font-display text-lg font-black text-sidebar-primary">
        帳
      </span>
      <span className="font-display text-xl font-bold tracking-wider">應收帳款管理系統</span>
    </Link>
  );
}
