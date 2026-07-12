import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

export default async function HomePage() {
  const token = await convexAuthNextjsToken();

  if (token) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
