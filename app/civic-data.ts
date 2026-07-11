export type Division = {
  title: string;
  items: string[];
};

export type BranchId =
  | "judicial"
  | "constitutional"
  | "executive"
  | "legislative";

export type Branch = {
  id: BranchId;
  title: string;
  subtitle: string;
  summary: string;
  count: string;
  divisions: Division[];
};

export const branches: Branch[] = [
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
