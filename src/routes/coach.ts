import { Router } from 'express';
import { z } from 'zod';
import { CohereClientV2 } from 'cohere-ai';
import admin from 'firebase-admin';

const router = Router();

const schema = z.object({
  prompt: z.string().min(1),
  daysSober: z.number().int().nonnegative().optional(),
  cravingLevel: z.number().int().min(0).max(10).optional(),
  language: z.enum(['en-ZA','zu-ZA','af-ZA']).default('en-ZA')
});

const cohere = new CohereClientV2({ token: process.env.COHERE_API_KEY! });
const model = process.env.COHERE_MODEL || 'command-r';

let firestore: admin.firestore.Firestore | null = null;

// Initialize Firebase
const initFirebase = async () => {
  if (admin.apps.length) return;
  
  try {
    const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (svcPath) {
      const fs = await import('fs');
      const serviceAccount = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      firestore = admin.firestore();
      console.log(' Firebase Admin initialized');
    } else {
      console.log(' Firebase disabled - no service account found');
    }
  } catch (e) {
    console.error(' Firebase initialization failed:', e);
  }
};

initFirebase();

router.post('/advice', async (req: any, res: any, next: any) => {
  try {
    const body = schema.parse(req.body);
    
    const response = await cohere.chat({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are SoberStride Coach, a compassionate sobriety mentor. Respond briefly (150-220 words) with encouragement and practical advice.'
        },
        {
          role: 'user', 
          content: `Language: ${body.language}, Days sober: ${body.daysSober ?? 'unknown'}, Craving level: ${body.cravingLevel ?? 'unknown'}, Request: ${body.prompt}`
        }
      ],
      temperature: 0.4,
      maxTokens: 400
    });

    const advice = (response.message?.content?.find?.((c: any) => c.type === 'text') as any)?.text || 'Unable to generate advice right now.';
    
    res.json({ ok: true, model, advice });

    // Save to Firestore async
    if (firestore) {
      firestore.collection('coaching').add({
        prompt: body.prompt,
        daysSober: body.daysSober,
        cravingLevel: body.cravingLevel, 
        language: body.language,
        advice,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(e => console.error('Firestore save failed:', e));
    }
  } catch (err) {
    next(err);
  }
});

export const coachRouter = router;
