import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "應收帳款管理系統" },
      { name: "description", content: "事務所內部應收帳款管理系統，請登入使用。" },
      { property: "og:title", content: "應收帳款管理系統" },
      { property: "og:description", content: "事務所內部應收帳款管理系統，請登入使用。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
