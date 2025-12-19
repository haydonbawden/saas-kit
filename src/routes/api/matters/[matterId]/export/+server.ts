import { error, json } from '@sveltejs/kit';
import { generateInitialLetter } from '$lib/server/pdf';
import { assertMatterAccess, logAudit } from '$lib/server/workspaces';

export const POST = async ({ params, request, locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) {
                throw error(401, 'Sign in required');
        }
        const supabase = locals.supabase as any;
        const matter = await assertMatterAccess(supabase, params.matterId);

        const body = await request.json().catch(() => ({}));
        const existingPath = body?.path as string | undefined;

        if (existingPath) {
                const { data: signedExisting } = await supabase.storage
                        .from('workspace-files')
                        .createSignedUrl(existingPath, 60 * 5);
                return json({ downloadUrl: signedExisting?.signedUrl ?? null });
        }

        const { data: charges } = await supabase
                .from('charges')
                .select('*')
                .eq('matter_id', matter.id);
        const { data: analysis } = await supabase
                .from('analysis_results')
                .select('*')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
        const { data: docs } = await supabase
                .from('matter_documents')
                .select('filename')
                .eq('matter_id', matter.id);
        const { data: clarifications } = await supabase
                .from('messages')
                .select('content')
                .eq('matter_id', matter.id)
                .eq('role', 'assistant')
                .order('created_at', { ascending: false })
                .limit(3);

        const pdfBytes = await generateInitialLetter({
                userName: session.user.user_metadata?.full_name || session.user.email || 'User',
                matterId: matter.id,
                workspaceId: matter.workspace_id,
                charges: charges ?? [],
                summary: analysis?.payload?.summary ?? 'Summary will be updated after full analysis completes.',
                keyDates: analysis?.payload?.keyDates ?? [],
                clarifications: clarifications?.map((msg: any) => msg.content) ?? [],
                gaps: analysis?.payload?.uncertainties ?? [],
                generalInfo: analysis?.payload?.generalInfo ?? [],
                documentsReviewed: docs?.map((doc: any) => doc.filename) ?? [],
        });

        const path = `${matter.workspace_id}/${matter.id}/exports/initial_information_letter_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
                .from('workspace-files')
                .upload(path, pdfBytes, {
                        contentType: 'application/pdf',
                        upsert: true,
                });
        if (uploadError) {
                throw error(500, uploadError.message);
        }

        await supabase
                .from('matter_exports')
                .insert({
                        workspace_id: matter.workspace_id,
                        matter_id: matter.id,
                        storage_path: path,
                        created_by: session.user.id,
                        metadata: { kind: 'initial_information_letter' },
                });

        const { data: signed } = await supabase.storage.from('workspace-files').createSignedUrl(path, 60 * 5);
        await logAudit(supabase, matter.workspace_id, session.user.id, 'export_generated', {
                matter_id: matter.id,
                path,
        });

        return json({ downloadUrl: signed?.signedUrl ?? null });
};
