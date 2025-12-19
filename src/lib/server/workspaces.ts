import type { SupabaseClient } from '@supabase/supabase-js';

type Workspace = {
        id: string;
        name: string;
};

type Matter = {
        id: string;
        workspace_id: string;
        title: string;
        status: string;
        smf_detected: boolean;
        smf_confidence: number | null;
        jurisdiction: string | null;
};

export async function ensureWorkspaceForUser(
        supabase: SupabaseClient<any>,
        userId: string,
        name = 'Workspace',
): Promise<Workspace> {
        const { data: membership } = await supabase
                .from('workspace_members')
                .select('workspace_id, workspaces!inner(id, name)')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();

        const workspaceRecord = (membership as any)?.workspaces as Workspace | Workspace[] | undefined;
        if (workspaceRecord) {
                return Array.isArray(workspaceRecord) ? workspaceRecord[0] : workspaceRecord;
        }

        const { data: createdWorkspace, error: workspaceError } = await supabase
                .from('workspaces')
                .insert({ name, created_by: userId })
                .select('*')
                .single();
        if (workspaceError || !createdWorkspace) {
                throw new Error(workspaceError?.message ?? 'Unable to provision workspace');
        }
        return createdWorkspace as Workspace;
}

export async function assertMatterAccess(
        supabase: SupabaseClient<any>,
        matterId: string,
): Promise<Matter> {
        const { data: matter, error } = await supabase
                .from('matters')
                .select('*')
                .eq('id', matterId)
                .single();
        if (error || !matter) {
                throw new Error(error?.message ?? 'Matter not found');
        }
        return matter as Matter;
}

export async function logAudit(
        supabase: SupabaseClient<any>,
        workspaceId: string,
        userId: string | null,
        action: string,
        metadata: Record<string, unknown> = {},
) {
        await supabase.from('audit_logs').insert({ workspace_id: workspaceId, user_id: userId, action, metadata });
}
