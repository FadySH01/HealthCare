/**
 * Small, reviewed health-information library for AERIX's no-cost offline guide.
 * This is a deterministic topic matcher, not generative AI, diagnosis, or triage.
 * Keep advice general and link users to trusted sources and licensed care.
 */
type GuideEntry = {
  id: string;
  match: RegExp;
  answer: string;
  source?: string;
  url?: string;
};
import { findHealthTopic, healthDataset } from "./health-dataset";

const urgent = "If this may be an emergency, contact local emergency services or go to the nearest emergency department now. AERIX does not monitor chats or dispatch help.";
const emergency: GuideEntry = {
  id: "urgent",
  match: /\b(unconscious|not waking|not breathing|can't breathe|cannot breathe|difficulty breathing|struggling to breathe|severe chest pain|chest pressure|stroke|face droop|one side weak|sudden weakness|heavy bleeding|severe bleeding|seizure|poisoning|overdose|suicid|self harm|self-harm|sudden (?:extremely )?(?:severe|painful) headache|worst headache|stiff neck)\b/i,
  answer: `This could need urgent help. ${urgent}`,
};

const entries: GuideEntry[] = [
  {
    id: "malaria",
    match: /\b(malaria|antimalarial|anti-malarial)\b/i,
    answer: "I can’t tell whether this is malaria from symptoms. Fever and other symptoms can have different causes; the World Health Organization recommends prompt testing for suspected malaria before treatment. Please arrange a malaria test and speak with a licensed clinician or pharmacist promptly. Don’t start an antimalarial based on this chat. AERIX Pharmacy is a sample catalogue and cannot diagnose or supply treatment. If there is confusion, seizure, difficulty breathing, collapse, or rapid worsening, seek emergency care now.",
    source: "WHO: malaria diagnosis and treatment",
    url: "https://www.who.int/teams/global-malaria-programme/case-management/treatment",
  },
  {
    id: "visit-preparation",
    match: /\b(doctor|clinician|appointment|hospital visit|prepare for (a )?(visit|doctor)|consultation)\b/i,
    answer: "To prepare for a health visit, write down what you want help with, when it began, how it has changed, and your main questions. Bring a list or packages/photos of medicines you use and note known allergies. Ask what the next step is, when to expect results, and whom to contact if things change. You can ask the clinician to explain anything that is unclear.",
    source: "NHS: What to ask your doctor",
    url: "https://www.nhs.uk/nhs-services/gps/what-to-ask-your-doctor/",
  },
  {
    id: "pharmacist",
    match: /\b(pharmacist|pharmacy|chemist|medicine question|medicine side effect|drug interaction)\b/i,
    answer: "A licensed pharmacist can help explain how a medicine is meant to be used and what to check. Tell them the exact product and strength, other medicines or supplements, allergies, pregnancy/breastfeeding if relevant, and health conditions. Ask what to do if you miss a dose, what side effects need help, and when to contact a clinician. AERIX cannot select a medicine or dose for you.",
    source: "NHS: What to ask your doctor",
    url: "https://www.nhs.uk/nhs-services/gps/what-to-ask-your-doctor/",
  },
  {
    id: "medicines",
    match: /\b(medicine|medication|tablet|dose|dosage|prescription|antibiotic|painkiller|paracetamol|ibuprofen|drug)\b/i,
    answer: "I can’t recommend a medicine or dose. Check the label and ask a licensed pharmacist or clinician, especially for a child, pregnancy, a long-term condition, allergies, or when taking other medicines. Don’t use another person’s prescription or stop a prescribed treatment without professional advice. If someone may have taken too much or the wrong medicine, seek urgent local medical advice now.",
  },
  {
    id: "cough",
    match: /\b(cough|coughing|phlegm|mucus|sore throat|cold|flu|runny nose)\b/i,
    answer: "A cough or sore throat can have many causes; this chat can’t identify which one. Note when it started, whether it is getting worse, any fever or breathing trouble, and any medicines already used. Contact a clinician if it is severe, worsening, persistent, or worrying. Trouble breathing, severe chest pain, confusion, blue/grey lips, or collapse needs urgent care. Don’t wait for AERIX in an emergency.",
    source: "NHS: Cough",
    url: "https://www.nhs.uk/symptoms/cough/",
  },
  {
    id: "fever",
    match: /\b(fever|high temperature|temperature|hot and shivering|chills)\b/i,
    answer: "A raised temperature can happen for many reasons, and the right advice depends on age, duration, other symptoms, pregnancy, and health conditions. If you are concerned, the person is getting worse, or the fever is in a very young baby, contact a clinician promptly. Seek urgent help for trouble breathing, unresponsiveness, seizure, severe confusion, or other rapidly worsening symptoms. I can’t diagnose the cause or recommend a medicine dose.",
  },
  {
    id: "headache",
    match: /\b(headache|migraine|head pain)\b/i,
    answer: "Headaches have many possible causes, so I can’t diagnose one here. Note when it began, how it feels, what else is happening, and any medicines taken; ask a clinician or pharmacist for advice if it is new, recurring, severe, or worrying. A sudden extremely severe headache, weakness on one side, trouble speaking, fainting, or confusion needs urgent medical care.",
  },
  {
    id: "stomach",
    match: /\b(stomach|tummy|abdominal|diarrh|vomit|vomiting|nausea|constipat)\w*\b/i,
    answer: "Stomach symptoms can have many causes. Note when they started, how often symptoms occur, whether there is blood, severe pain, fever, or difficulty keeping fluids down, and contact a clinician if symptoms are severe, worsening, or persistent. Seek urgent care for severe abdominal pain, blood in vomit or stool, fainting, confusion, or signs of serious dehydration. This guide can’t diagnose the cause.",
  },
  {
    id: "hydration",
    match: /\b(water|hydration|dehydrat|thirsty|fluids)\w*\b/i,
    answer: "Needs vary with a person’s age, activity, climate, pregnancy, and health conditions. Drink regularly and pay attention to thirst; a clinician may give different fluid advice for some heart or kidney conditions. If illness makes it hard to keep fluids down, or there is very little urine, marked drowsiness, fainting, or confusion, seek medical advice urgently.",
  },
  {
    id: "mental-wellbeing",
    match: /\b(stress|anxious|anxiety|panic|sad|depress|mental health|overwhelmed|worrying)\w*\b/i,
    answer: "I’m sorry this feels difficult. If you can, tell someone you trust and consider speaking with a qualified health professional. Small steps like a calm breathing break, gentle movement, regular meals, rest, and keeping a simple routine may support wellbeing, but they are not a substitute for care. If you might hurt yourself or someone else, or cannot stay safe, contact local emergency services or go to an emergency department now; don’t wait for this chat.",
  },
  {
    id: "sleep",
    match: /\b(sleep|insomnia|can't sleep|cannot sleep|tired|fatigue|exhausted)\b/i,
    answer: "A steady wake-up time, a quiet wind-down routine, daylight and movement during the day, and reducing late caffeine may help some people sleep. Sleep needs and causes of tiredness differ. If sleep problems persist, affect daily life, or come with other symptoms, discuss them with a clinician. Avoid starting sleep medicines without professional advice.",
  },
  {
    id: "healthy-eating",
    match: /\b(diet|healthy eat|nutrition|food|fruit|vegetable|sugar|salt|weight loss|lose weight)\w*\b/i,
    answer: "A balanced eating pattern can include a variety of locally available vegetables and fruit, beans or other pulses, whole grains, and suitable protein. Needs differ by age, pregnancy, culture, budget, and health conditions, so there is no single diet for everyone. If you have a medical condition, food restriction, or unplanned weight change, ask a clinician or dietitian for personal advice.",
    source: "WHO: Healthy diet",
    url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  {
    id: "daily-habits",
    match: /\b(healthy (daily )?habits?|daily habits?|wellbeing|well-being|self care|self-care|stay healthy|healthy lifestyle)\b/i,
    answer: "Helpful foundations can include varied nourishing food, regular movement that suits your ability, enough rest, avoiding tobacco, limiting alcohol, and staying connected with people you trust. Choose small steps that fit your life; personal health conditions may change what is suitable. A clinician can help tailor advice to you.",
    source: "WHO: Self-care for health and well-being",
    url: "https://www.who.int/news-room/fact-sheets/detail/self-care-health-interventions",
  },
  {
    id: "physical-activity",
    match: /\b(exercise|physical activity|walking|workout|fitness|sedentary)\b/i,
    answer: "Movement can include walking, active travel, chores, play, or sport. Start gently at a level that feels manageable and increase gradually if comfortable. Choose activity that fits your ability and circumstances; a clinician can advise if you have symptoms, a disability, pregnancy-related concerns, or a condition that affects exercise. Stop and seek care for severe chest pain, fainting, or serious breathing difficulty.",
    source: "WHO: Physical activity",
    url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
  },
  {
    id: "blood-pressure",
    match: /\b(blood pressure|hypertension|high bp|low bp)\b/i,
    answer: "Blood pressure readings need the correct cuff, technique, and interpretation in context. One reading alone may not establish a diagnosis. Ask a health professional when and how to measure it and what your own results mean. Do not start, stop, or change blood-pressure medicine based on this guide. Severe chest pain, weakness on one side, fainting, or serious breathing trouble needs urgent care.",
  },
  {
    id: "diabetes",
    match: /\b(diabetes|blood sugar|glucose|insulin)\b/i,
    answer: "Diabetes care is personal. A clinician can explain tests, targets, monitoring, food, activity, and medicines for an individual situation. Don’t change insulin or other diabetes medicine based on this guide. If a person with diabetes is confused, unconscious, having a seizure, or rapidly worsening, seek emergency care immediately.",
  },
  {
    id: "pregnancy",
    match: /\b(pregnan|antenatal|prenatal|baby moving|labour|labor|bleeding while pregnant)\w*\b/i,
    answer: "For pregnancy questions, contact a midwife or qualified clinician who can consider the stage of pregnancy and your circumstances. Keep antenatal appointments and ask which symptoms should prompt urgent assessment. Heavy bleeding, severe pain, fainting, seizure, severe headache with vision changes, or difficulty breathing needs urgent maternity or emergency care now.",
  },
  {
    id: "vaccines",
    match: /\b(vaccine|vaccination|immuni[sz]ation|immuni[sz]e|immuni[sz]ed)\w*\b/i,
    answer: "Vaccines protect against specific infections, and recommended schedules vary by age, country, pregnancy, health conditions, and previous doses. Ask a local clinic or health authority which vaccines are due and bring any available vaccination record. AERIX can’t determine an individual’s eligibility or replace local public-health guidance.",
  },
  {
    id: "hygiene",
    match: /\b(hand washing|wash hands|hand hygiene|prevent infection|infection prevention)\b/i,
    answer: "Washing hands with soap and clean running water helps reduce the spread of germs, especially before preparing or eating food and after using the toilet. If soap and water are unavailable, an appropriate alcohol-based hand rub can be an alternative when hands are not visibly dirty. Follow local public-health guidance for specific infections.",
  },
  {
    id: "first-aid",
    match: /\b(first aid|injury|burn|wound|cut|bleeding)\b/i,
    answer: "For serious injury, heavy bleeding, a major burn, breathing problems, or reduced consciousness, contact local emergency services or go to emergency care now. For a minor injury, seek advice from a trained first-aid provider or clinician if you are unsure what to do, if the wound is deep/dirty, or if it worsens. AERIX cannot assess an injury from text or dispatch help.",
  },
  {
    id: "find-care",
    match: /\b(find care|hospital|clinic|doctor near|directions|location|book|booking|appointment near)\b/i,
    answer: "Open Find care to explore nearby public map listings and Appointments to prepare an enquiry. Map listings may be incomplete and are not automatically AERIX partners; call the facility to confirm it is open, offers the service, and can see you. AERIX cannot confirm a booking or live capacity.",
  },
  {
    id: "greeting",
    match: /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|hey man)[!.?\s]*$/i,
    answer: "Hi! I can share general information about common health topics, medicines safety, preparing for a visit, healthy habits, and finding care. What would you like to know? Please don’t include names, addresses, account details, or other private information.",
  },
];

export const offlineGuideTopics = entries
  .filter((entry) => entry.id !== "urgent" && entry.id !== "greeting")
  .map(({ id }) => id)
  .concat(healthDataset.map(({ id }) => id))
  .filter((id, index, all) => all.indexOf(id) === index);

function formatHealthTopic(topic: NonNullable<ReturnType<typeof findHealthTopic>>) {
  return [
    `${topic.id[0].toUpperCase()}${topic.id.slice(1)}: ${topic.overview}`,
    `Prevention: ${topic.prevention}`,
    `Treatment and next step: ${topic.care}`,
    `Seek urgent help: ${topic.urgent}`,
    `Source: ${topic.source} — ${topic.url} (reviewed ${topic.reviewedOn})`,
    "This is general information, not a diagnosis or personal medical advice.",
  ].join("\n\n");
}

export function offlineGuideReply(question: string): string {
  const q = question.trim();
  if (!q) return "Type a general health question and I’ll look for a matching topic in this offline guide.";
  if (emergency.match.test(q)) return `${emergency.answer}\n\n${urgent}`;
  const healthTopic = findHealthTopic(q);
  if (healthTopic) return formatHealthTopic(healthTopic);
  const entry = entries.find((item) => item.match.test(q));
  if (entry) {
    return `${entry.answer}${entry.source && entry.url ? `\n\nSource: ${entry.source} — ${entry.url}` : ""}\n\nThis is general information, not a diagnosis or personal medical advice.`;
  }
  return "I don’t have a specific answer for that topic in this offline guide yet. I can help with preparing for a health visit, medicines safety, coughs and fevers, stomach symptoms, sleep, stress, food, physical activity, blood pressure, diabetes, pregnancy, vaccines, first aid, or finding care. For personal symptoms or treatment decisions, contact a licensed clinician or pharmacist.\n\nThis guide does not diagnose, prescribe, monitor emergencies, or dispatch an ambulance.";
}
