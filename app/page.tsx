import type { Metadata } from "next";
import { headers } from "next/headers";

type Division = {
  title: string;
  items: string[];
};

type Branch = {
  id: "judicial" | "constitutional" | "executive" | "legislative";
  title: string;
  subtitle: string;
  summary: string;
  count: string;
  divisions: Division[];
};

const branches: Branch[] = [
  {
    id: "judicial",
    title: "Judicial Branch",
    subtitle: "Local courts and city constable",
    summary: "Courts",
    count: "2 offices",
    divisions: [
      {
        title: "City Court",
        items: ["City Court *", "City Constable *"],
      },
    ],
  },
  {
    id: "constitutional",
    title: "State Constitutional Offices",
    subtitle: "Parish offices defined by state law",
    summary: "Parish offices",
    count: "11 offices",
    divisions: [
      {
        title: "Courts and records",
        items: [
          "Assessor *",
          "District Court *",
          "Clerk of Court *",
          "Family Court *",
          "Juvenile Court *",
        ],
      },
      {
        title: "Public legal offices",
        items: [
          "Sheriff *",
          "District Attorney *",
          "Registrar of Voters *",
          "Coroner *",
          "Public Defender *",
        ],
      },
    ],
  },
  {
    id: "executive",
    title: "Executive Branch",
    subtitle: "Mayor-President *",
    summary: "Administration",
    count: "18 departments",
    divisions: [
      {
        title: "Operations",
        items: [
          "Finance",
          "Human Resources",
          "Information Services",
          "Purchasing",
          "Quality & Employee Development",
          "Service Fee Business Department",
        ],
      },
      {
        title: "Safety and infrastructure",
        items: [
          "Police",
          "Fire",
          "Emergency Medical Services",
          "Juvenile Services",
          "Emergency Preparedness",
          "Public Works",
        ],
      },
      {
        title: "Community services",
        items: [
          "Anti-Drug Task Force",
          "Citizens Service",
          "Inspector General",
          "Human Development & Services",
          "Riverside Centroplex",
        ],
      },
    ],
  },
  {
    id: "legislative",
    title: "Legislative Branch",
    subtitle: "Metropolitan Council *",
    summary: "Council",
    count: "17 offices and boards",
    divisions: [
      {
        title: "Council offices",
        items: [
          "Council Administrator-Treasurer",
          "Council Budget Office",
          "Parish Attorney",
          "Public Information Office",
          "Animal Control Center",
        ],
      },
      {
        title: "Boards and commissions",
        items: [
          "Administrative Boards",
          "Planning Commission",
          "Municipal Fire & Police Civil Service Board **",
          "Mosquito Abatement & Rodent Control",
          "Library Board of Control",
          "Downtown Development District",
        ],
      },
      {
        title: "Districts and authorities",
        items: [
          "Administrative Boards",
          "EBRP Communications District",
          "Fire Protection Districts **",
          "Capital Transportation Corporation",
          "GBR Airport Commission",
        ],
      },
    ],
  },
];

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
  return (
    <main className="home-shell">
      <header className="site-header" aria-label="Site header">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <p className="site-kicker">East Baton Rouge Parish</p>
          <p className="site-name">We the People Baton Rouge</p>
        </div>
      </header>

      <section className="map-section" aria-labelledby="map-title">
        <div className="intro-panel">
          <p className="eyebrow">Local civic structure</p>
          <h1 id="map-title">Baton Rouge government, simplified</h1>
          <p className="intro-copy">
            Citizens at the top. Branches below. Offices and departments grouped
            into a readable map.
          </p>
        </div>

        <div className="map-canvas" aria-label="Organization map">
          <div className="citizens-node">
            <span className="node-label">Citizens of East Baton Rouge Parish</span>
            <span className="node-detail">voters, residents, neighborhoods</span>
          </div>

          <div className="branch-grid">
            {branches.map((branch) => (
              <article className={`branch branch-${branch.id}`} key={branch.id}>
                <div className="branch-heading">
                  <div>
                    <p className="branch-summary">{branch.summary}</p>
                    <h2>{branch.title}</h2>
                    <p>{branch.subtitle}</p>
                  </div>
                  <span>{branch.count}</span>
                </div>

                <div className="division-stack">
                  {branch.divisions.map((division) => (
                    <section className="division-card" key={division.title}>
                      <h3>{division.title}</h3>
                      <ul>
                        {division.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="legend" aria-label="Chart legend">
          <span>* Elected officials</span>
          <span>** State statutorily defined offices/funds</span>
        </aside>
      </section>
    </main>
  );
}
