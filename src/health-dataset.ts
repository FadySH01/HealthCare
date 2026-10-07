/**
 * Small, curated offline health-information dataset for the AERIX guide.
 * This is local retrieval content, not model training or a clinical decision system.
 * Keep advice general, reviewed, source-linked, and free of medication/dose instructions.
 */
export type HealthTopic = {
  id: string;
  match: RegExp;
  overview: string;
  prevention: string;
  care: string;
  urgent: string;
  source: string;
  url: string;
  reviewedOn: string;
};

export const healthDataset: HealthTopic[] = [
  {
    id: "malaria",
    match: /\b(malaria|antimalarial|anti-malarial)\b/i,
    overview: "Malaria is an infection spread by bites from infected mosquitoes. Fever, chills, and headache can have other causes too, so symptoms alone cannot confirm malaria.",
    prevention: "Use an insecticide-treated bed net and follow local mosquito-control advice. Ask a clinician or local health service about preventive medicines or malaria vaccination for eligible children; these depend on the person and local programme.",
    care: "Arrange prompt testing with a rapid diagnostic test or blood microscopy before treatment. If malaria is confirmed, a qualified clinician should choose treatment based on current local guidance. Malaria is treatable, but this guide cannot choose a medicine or dose.",
    urgent: "Confusion, seizure, difficulty breathing, collapse, or rapid worsening needs emergency care now.",
    source: "WHO: Malaria questions and answers",
    url: "https://www.who.int/news-room/questions-and-answers/item/malaria",
    reviewedOn: "2026-09-28",
  },
  {
    id: "typhoid",
    match: /\b(typhoid|salmonella\s*typhi)\b/i,
    overview: "Typhoid is an infection usually spread through contaminated food or water. Prolonged fever, headache, tiredness, stomach pain, nausea, constipation, or diarrhoea can occur, but these symptoms do not prove typhoid.",
    prevention: "Use safe drinking water and sanitation, wash hands with soap, handle food hygienically, and ask a local health service whether typhoid vaccination is recommended and available.",
    care: "Contact a clinician for assessment and appropriate testing; WHO notes typhoid can be confirmed through blood testing. Typhoid can be treated with antibiotics, but resistance to antibiotics is common, so a clinician must select treatment. Take only prescribed antibiotics and follow the prescriber's instructions.",
    urgent: "Severe or worsening illness, confusion, fainting, inability to keep fluids down, or signs of dehydration needs urgent medical assessment.",
    source: "WHO: Typhoid",
    url: "https://www.who.int/news-room/fact-sheets/detail/typhoid",
    reviewedOn: "2026-09-28",
  },
  {
    id: "diarrhoea",
    match: /\b(diarrh\w*|loose stools?|watery stools?)\b/i,
    overview: "Diarrhoea has many possible causes and can lead to dehydration, especially in young children and older or medically vulnerable people.",
    prevention: "Use safe water, wash hands with soap, handle and prepare food safely, and follow local vaccination guidance, including rotavirus vaccination for eligible children.",
    care: "Replace fluids. Oral rehydration salts (ORS) can help prevent or treat dehydration; mix a sealed packet exactly as its label says and ask a pharmacist or clinician if unsure. Continue appropriate food and breastfeeding. Contact a clinician for persistent diarrhoea, blood in stool, or signs of dehydration; severe dehydration may need urgent treatment.",
    urgent: "Seek urgent care for very little urine, marked drowsiness, fainting, confusion, inability to keep fluids down, blood in stool, or rapidly worsening symptoms.",
    source: "WHO: Diarrhoeal disease",
    url: "https://www.who.int/health-topics/diarrhoea",
    reviewedOn: "2026-09-28",
  },
  {
    id: "headache",
    match: /\b(headaches?|migraine|head pain)\b/i,
    overview: "A headache is a symptom with many possible causes; this guide cannot tell which cause applies to you.",
    prevention: "Regular meals, enough fluids, rest, stress management, and noting possible triggers in a headache diary may help some people. Recurring or worsening headaches should be discussed with a clinician.",
    care: "Note when it began, how it feels, other symptoms, and any medicines already taken. Rest and drink fluids if appropriate for you. Ask a clinician or pharmacist about treatment rather than relying on this guide for medicine or dosing advice.",
    urgent: "A sudden extremely painful headache, weakness or numbness, trouble speaking or walking, confusion, seizure, loss of vision, recent head injury, or headache with a very high fever and stiff neck needs emergency care now.",
    source: "NHS: Headaches",
    url: "https://www.nhs.uk/symptoms/headaches/",
    reviewedOn: "2026-09-28",
  },
];

export function findHealthTopic(question: string): HealthTopic | undefined {
  return healthDataset.find((topic) => topic.match.test(question));
}
