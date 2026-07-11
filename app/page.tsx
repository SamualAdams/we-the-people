import type { Metadata } from "next";
import { headers } from "next/headers";
import { CivicMap } from "./CivicMap";
import { branches } from "./civic-data";

const pageTitle = "Baton Rouge Civic Map";
const pageDescription =
  "A simple map of East Baton Rouge Parish local government, from citizens to branches, offices, departments, boards, and districts.";

function getRequestOrigin(requestHeaders: Headers) {
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host ?? "localhost:3000"}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const origin = getRequestOrigin(requestHeaders);
  const imageUrl = `${origin}/og.png`;

  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      type: "website",
      url: origin,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "Baton Rouge Civic Map",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: [imageUrl],
    },
  };
}

export default function Home() {
  return <CivicMap branches={branches} />;
}
