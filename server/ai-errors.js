export function aiFailureMessage(error) {
  if (error?.code === "insufficient_quota" || error?.code === "credit_balance_exhausted")
    return "AERIX AI is paused because its API project has no available credit. Your message was not answered or saved. Please use Find care to contact a clinician for symptoms.";
  if (error?.status === 429)
    return "AERIX AI is temporarily busy. Your message was not answered or saved. Please try again shortly. For urgent concerns, seek local medical care.";
  return "The AI service is unavailable. Please try again later. For urgent concerns, seek local medical care.";
}
