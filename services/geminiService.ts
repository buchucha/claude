import { GoogleGenAI, Type } from "@google/genai";
import { SOAPRecord, Patient } from "../types";

/**
 * Extract JSON from AI response and parse it safely.
 */
const parseAIResponse = (text: string | undefined) => {
  if (!text) return null;
  try {
    let cleanText = text.trim();
    if (cleanText.includes("```")) {
      const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanText = match[1].trim();
      }
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("AI JSON Parse Error:", e, text);
    return null;
  }
};

/**
 * 1. O(Objective) Suggestion: Recommend diagnostic tests only.
 */
export const getDiagnosticSuggestions = async (patient: Patient, soap: Partial<SOAPRecord>) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      As a veterinary expert, recommend a list of diagnostic tests (imaging, blood tests, cytology, etc.) based on the patient's information.
      Important: Do not include actual treatments (medication, surgery); suggest only tests for diagnosis.
      Patient Data:
      - Info: ${patient.species}, ${patient.breed}, ${patient.age}, ${patient.weight}kg
      - S(Subjective): "${soap.subjective || 'No info'}"
      - O(Objective observations): "${soap.objective || 'No observations'}"

      Response must be in JSON format: { "suggestions": [{ "testName": "Test Name", "reason": "Reason", "priority": "High/Medium/Low" }] }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  testName: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ["testName", "reason", "priority"]
              }
            }
          }
        }
      }
    });
    return parseAIResponse(response.text);
  } catch (error) {
    console.error("Diagnostic API Error:", error);
    return null;
  }
};

/**
 * 2. A(Assessment) Suggestion: Differential Diagnoses (DDx).
 */
export const getDifferentialDiagnoses = async (patient: Patient, soap: Partial<SOAPRecord>) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const labInfo = JSON.stringify(soap.labResults || {});
    const prompt = `
      Based on the patient's information, suggest a list of potential differential diagnoses (DDx).
      Reference Data:
      - S(Subjective): "${soap.subjective || ''}"
      - O(Labs/Vitals): "${soap.objective || ''}", Lab: ${labInfo}
      - Problem List: "${soap.assessmentProblems || ''}"

      Response must be in JSON format: { "diagnoses": [{ "name": "Diagnosis Name", "reason": "Reason", "confidence": "0-100%" }] }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnoses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  confidence: { type: Type.STRING }
                },
                required: ["name", "reason", "confidence"]
              }
            }
          }
        }
      }
    });
    return parseAIResponse(response.text);
  } catch (error) {
    console.error("DDx API Error:", error);
    return null;
  }
};

/**
 * 3. P(Plan) Suggestion: Recommended Treatments (Tx).
 */
export const getTxSuggestions = async (patient: Patient, soap: Partial<SOAPRecord>) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      As a veterinarian, recommend a list of actual treatments (Tx), surgeries, or procedures.
      Strict Rule: Do not include diagnostic tests like CT, MRI, X-ray, or blood tests. Only include treatment actions (fluid therapy, medication administration, dressing, surgery, etc.).
      Reference Data:
      - S: ${soap.subjective || ''}
      - O: ${soap.objective || ''}
      - A: ${soap.assessmentProblems || ''} (DDx: ${JSON.stringify(soap.assessmentDdx || [])})

      Response must be in JSON format: { "suggestions": [{ "txName": "Treatment Name", "details": "Dosage/Method/Cautions", "reason": "Reason", "priority": "High/Medium" }] }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  txName: { type: Type.STRING },
                  details: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ["txName", "details", "reason", "priority"]
              }
            }
          }
        }
      }
    });
    return parseAIResponse(response.text);
  } catch (error) {
    console.error("Tx API Error:", error);
    return null;
  }
};

/**
 * 4. Rx Suggestion: Medication recommendations.
 */
export const getRxSuggestions = async (patient: Patient, soap: Partial<SOAPRecord>) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      As a veterinary pharmacology expert, recommend a prescription (Rx).
      Include dosage, frequency/route, and detailed precautions.
      Reference Data:
      - S: ${soap.subjective || ''}
      - O: ${soap.objective || ''}
      - A: ${soap.assessmentProblems || ''}

      Response must be in JSON format: { "suggestions": [{ "medName": "Medication Name", "dosage": "Dosage/Freq", "caution": "Precautions", "reason": "Reason" }] }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  medName: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  caution: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["medName", "dosage", "caution", "reason"]
              }
            }
          }
        }
      }
    });
    return parseAIResponse(response.text);
  } catch (error) {
    console.error("Rx API Error:", error);
    return null;
  }
};

/**
 * 5. Summary Suggestion: Discharge summary for owners.
 */
export const getSummarySuggestions = async (patient: Patient, soap: Partial<SOAPRecord>) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Write a discharge summary for the owner. Write in English. Maintain a professional yet warm and gentle tone.
      Patient: ${patient.name} (${patient.species}, ${patient.weight}kg).
      Clinical Record:
      - S: ${soap.subjective}
      - O: ${soap.objective}
      - A: ${soap.assessmentProblems}
      - P: ${soap.planTx}, ${soap.planRx}

      Requirements:
      1. [Education/Advice]: Home care instructions and prescription diet recommendations.
      2. [Cautions]: Predicted side effects or post-treatment reactions to mitigate owner complaints.
      3. [Future Plan]: Specific recheck timeline and planned future tests.

      Response must be in JSON format: { "education": "Care Advice", "disclaimer": "Complaint Prevention", "futurePlan": "Future Visit Plan" }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            education: { type: Type.STRING },
            disclaimer: { type: Type.STRING },
            futurePlan: { type: Type.STRING }
          },
          required: ["education", "disclaimer", "futurePlan"]
        }
      }
    });
    return parseAIResponse(response.text);
  } catch (error) {
    console.error("Summary API Error:", error);
    return null;
  }
};