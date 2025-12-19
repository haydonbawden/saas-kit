import type { PageServerLoad } from './$types';
import { ensureWorkspaceForUser } from '$lib/server/workspaces';

export const load: PageServerLoad = async ({ locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) return { matters: [], workspace: null };

        const supabase = locals.supabase as any;
        const workspace = await ensureWorkspaceForUser(supabase, session.user.id, `${session.user.email}'s workspace`);
        const { data: matters } = await supabase
                .from('matters')
                .select('id, title, status, smf_detected, smf_confidence, created_at')
                .eq('workspace_id', workspace.id)
                .order('created_at', { ascending: false });

        const { data: charges } = await supabase
                .from('charges')
                .select('id, matter_id, title, description, confidence')
                .eq('workspace_id', workspace.id);

        const matterCharges = (matters ?? []).map((matter: any) => ({
                ...matter,
                charges: (charges ?? []).filter((charge: any) => charge.matter_id === matter.id),
        }));

        return { matters: matterCharges, workspace };
};
