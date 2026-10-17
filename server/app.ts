import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { createChallengeSchema, WAKE_UP_PROOF, type Challenge, type HealthResponse } from '../shared/contracts.ts';
import type { ChallengeStore } from './store.ts';

export function createApp(store: ChallengeStore, now = () => new Date()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    const health: HealthResponse = { status: 'ok', integrations: { rgb: 'not_connected', qvac: 'not_connected' } };
    res.json(health);
  });

  app.get('/api/challenges', (_req, res) => { res.json({ challenges: store.list() }); });

  app.get('/api/challenges/:id', (req, res) => {
    const challenge = store.get(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challenge not found.' } });
      return;
    }
    res.json({ challenge });
  });

  app.post('/api/challenges', (req, res) => {
    const parsed = createChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        (fields[key] ??= []).push(issue.message);
      }
      res.status(400).json({ error: { code: 'INVALID_CHALLENGE', message: 'Check the challenge details.', fields } });
      return;
    }
    const timestamp = now();
    if (Date.parse(parsed.data.bettingClosesAt) <= timestamp.getTime()) {
      res.status(400).json({ error: {
        code: 'INVALID_CHALLENGE', message: 'The betting cutoff must be in the future.',
        fields: { bettingClosesAt: ['Choose a future betting cutoff.'] },
      } });
      return;
    }
    const challenge: Challenge = {
      ...parsed.data, id: randomUUID(), createdAt: timestamp.toISOString(), status: 'draft',
      termsEditable: false, proof: WAKE_UP_PROOF,
      funding: { status: 'not_connected', network: 'mutinynet', confirmedPoolUsdt: null },
    };
    store.insert(challenge);
    res.status(201).location(`/api/challenges/${challenge.id}`).json({ challenge });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(error.type === 'entity.too.large' ? 413 : 400).json({
        error: { code: 'INVALID_BODY', message: 'Send valid JSON smaller than 16 KB.' },
      });
      return;
    }
    console.error(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request failed. Try again.' } });
  };
  app.use(handleError);
  return app;
}
