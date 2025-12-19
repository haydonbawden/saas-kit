import type { PageServerLoad } from './$types';
import { assertMatterAccess } from '$lib/server/workspaces';

export const load: PageServerLoad = async ({ params, locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) return { matter: null };

        const supabase = locals.supabase as any;
        const matter = await assertMatterAccess(supabase, params.matterId);
        const { data: charges } = await supabase
                .from('charges')
                .select('*')
                .eq('matter_id', matter.id);
        const { data: extractedPages } = await supabase
                .from('extracted_pages')
                .select('id, text, is_smf, confidence, created_at')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: true });
        const { data: analysis } = await supabase
                .from('analysis_results')
                .select('*')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
        const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: true })
                .limit(50);
        const { data: exports } = await supabase
                .from('matter_exports')
                .select('*')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: false });

        return {
                matter,
                charges: (charges ?? []) as any[],
                extractedPages: (extractedPages ?? []) as any[],
                analysis: analysis as any,
                messages: (messages ?? []) as any[],
                exports: (exports ?? []) as any[],
        };
};
