import { error, json } from '@sveltejs/kit';
import { buildSuggestedQuestions, detectSmfMarker, upsertCharges } from '$lib/server/analysis';
import { ensureWorkspaceForUser, logAudit } from '$lib/server/workspaces';

export const POST = async ({ request, locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) {
                throw error(401, 'Sign in required');
        }

        const supabase = locals.supabase as any;

        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        const matterTitle = (formData.get('title') as string) || 'New matter';
        if (!files.length) {
                throw error(400, 'No files provided');
        }

        const workspace = await ensureWorkspaceForUser(supabase, session.user.id, `${session.user.email}'s workspace`);

        const { data: matter, error: matterError } = await supabase
                .from('matters')
                .insert({
                        workspace_id: workspace.id,
                        title: matterTitle,
                        status: 'uploading',
                        created_by: session.user.id,
                        jurisdiction: 'WA',
                })
                .select('*')
                .single();
        if (matterError || !matter) {
                throw error(500, matterError?.message ?? 'Unable to create matter');
        }

        const extractedSnippets: { content: string; source_page_id?: string }[] = [];
        let smfFound = false;

        for (const file of files) {
                const path = `${workspace.id}/${matter.id}/uploads/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                        .from('workspace-files')
                        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
                if (uploadError) {
                        throw error(500, uploadError.message);
                }

                const { data: document, error: docError } = await supabase
                        .from('matter_documents')
                        .insert({
                                workspace_id: workspace.id,
                                matter_id: matter.id,
                                filename: file.name,
                                storage_path: path,
                                kind: 'unknown',
                                uploaded_by: session.user.id,
                        })
                        .select('*')
                        .single();
                if (docError || !document) {
                        throw error(500, docError?.message ?? 'Failed to record document');
                }

                const { data: page, error: pageError } = await supabase
                        .from('matter_document_pages')
                        .insert({
                                workspace_id: workspace.id,
                                matter_id: matter.id,
                                matter_document_id: document.id,
                                storage_path: path,
                                page_number: 1,
                        })
                        .select('*')
                        .single();
                if (pageError || !page) {
                        throw error(500, pageError?.message ?? 'Failed to register page');
                }

                const placeholderText = `Captured page from ${file.name}. Full OCR will run server-side. Statement headings and charge keywords will be detected automatically.`;
                const isSmf = detectSmfMarker(file.name, placeholderText);
                smfFound = smfFound || isSmf;
                const { data: extracted, error: extractedError } = await supabase
                        .from('extracted_pages')
                        .insert({
                                workspace_id: workspace.id,
                                matter_id: matter.id,
                                matter_document_page_id: page.id,
                                text: placeholderText,
                                confidence: 0.35,
                                is_smf: isSmf,
                        })
                        .select('*')
                        .single();
                if (extractedError || !extracted) {
                        throw error(500, extractedError?.message ?? 'Failed to register extraction placeholder');
                }
                extractedSnippets.push({ content: placeholderText, source_page_id: extracted.id });
        }

        const charges = await upsertCharges(supabase, workspace.id, matter.id, extractedSnippets);
        await supabase
                .from('matters')
                .update({
                        status: smfFound ? 'uploaded' : 'needs_smf',
                        smf_detected: smfFound,
                        smf_confidence: smfFound ? 0.4 : 0,
                })
                .eq('id', matter.id);

        await logAudit(supabase, workspace.id, session.user.id, 'matter_created', {
                matter_id: matter.id,
                documents: files.map((file) => file.name),
        });

        return json({
                matterId: matter.id,
                workspaceId: workspace.id,
                smfFound,
                charges,
                suggestedQuestions: buildSuggestedQuestions(charges, smfFound ? [] : ['statement of material facts']),
        });
};
