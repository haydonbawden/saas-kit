import type { SupabaseClient } from '@supabase/supabase-js';

const CHARGE_KEYWORDS: Record<string, { title: string; description: string }> = {
        assault: {
                title: 'Assault',
                description: 'Allegation of assault under WA Criminal Code. Description is general and not tailored.',
        },
        theft: {
                title: 'Stealing',
                description: 'Allegation of stealing under WA law with general wording only.',
        },
        drug: {
                title: 'Prohibited drug possession',
                description: 'Possession of prohibited drugs as a general category (non-specific).',
        },
        weapon: {
                title: 'Weapons related allegation',
                description: 'Apparent reference to weapons or restricted items.',
        },
};

export const knowledgeBase = [
        {
                id: 'kb-wa-process',
                title: 'WA criminal process basics',
                body: 'In Western Australia, prosecution is typically initiated by police or prosecuting authorities. Matters are listed in the Magistrates Court for first appearance. The Statement of Material Facts summarises the alleged conduct. This service explains documents in neutral terms only.',
        },
        {
                id: 'kb-sentencing',
                title: 'General factors for courts',
                body: 'Courts consider the charge, any applicable legislation, facts as alleged, and procedural fairness. This system does not predict outcomes and only restates information.',
        },
];

export function detectSmfMarker(name: string, text?: string | null) {
        const source = `${name} ${text ?? ''}`.toLowerCase();
        return source.includes('statement of material facts') || source.includes('smf');
}

export function deriveChargeFromText(text: string) {
        const lower = text.toLowerCase();
        const match = Object.keys(CHARGE_KEYWORDS).find((key) => lower.includes(key));
        if (!match) {
                        return {
                                title: 'Charge to be confirmed',
                                description: 'Awaiting clearer details. This is a neutral placeholder until analysis completes.',
                                confidence: 0.35,
                                jurisdiction: null,
                        };
        }
        const entry = CHARGE_KEYWORDS[match];
        return {
                title: entry.title,
                description: entry.description,
                confidence: 0.65,
                jurisdiction: 'WA',
        };
}

export function buildSuggestedQuestions(charges: { title: string; description?: string }[], uncertainties: string[]) {
        const questions = new Set<string>();
        charges.forEach((charge) => {
                questions.add(`What does ${charge.title} generally mean in plain English?`);
                questions.add(`What parts of the Statement of Material Facts relate to ${charge.title}?`);
        });
        uncertainties.forEach((gap) => {
                questions.add(`What is unclear or missing about ${gap}?`);
        });
        questions.add('Which sections of the Statement of Material Facts were most important?');
        questions.add('What information seems unclear or missing?');
        return Array.from(questions);
}

export async function upsertCharges(
        supabase: SupabaseClient<any>,
        workspaceId: string,
        matterId: string,
        texts: { content: string; source_page_id?: string }[],
) {
        const records = texts.map((entry) => {
                const charge = deriveChargeFromText(entry.content);
                return {
                        workspace_id: workspaceId,
                        matter_id: matterId,
                        title: charge.title,
                        description: charge.description,
                        confidence: charge.confidence,
                        jurisdiction: charge.jurisdiction,
                        source_page_id: entry.source_page_id,
                };
        });
        if (!records.length) return [];
        const { data, error } = await supabase.from('charges').insert(records).select('*');
        if (error) {
                throw new Error(error.message);
        }
        return data ?? [];
}
