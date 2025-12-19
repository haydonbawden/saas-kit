import { error, json } from '@sveltejs/kit';
import { buildSuggestedQuestions, knowledgeBase, upsertCharges } from '$lib/server/analysis';
import { assertMatterAccess, logAudit } from '$lib/server/workspaces';

export const POST = async ({ params, locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) {
                throw error(401, 'Sign in required');
        }
        const matterId = params.matterId;
        const supabase = locals.supabase as any;
        const matter = await assertMatterAccess(supabase, matterId);

        const { data: smfPages } = await supabase
                .from('extracted_pages')
                .select('*')
                .eq('matter_id', matterId)
                .eq('is_smf', true);
        if (!smfPages || smfPages.length === 0) {
                throw error(400, 'Statement of Material Facts required before analysis');
        }

        const { data: analysisJob, error: jobError } = await supabase
                .from('analysis_jobs')
                .insert({
                        workspace_id: matter.workspace_id,
                        matter_id: matter.id,
                        job_type: 'initial_information',
                        status: 'running',
                        started_at: new Date().toISOString(),
                        created_by: session.user.id,
                })
                .select('*')
                .single();
        if (jobError || !analysisJob) {
                throw error(500, jobError?.message ?? 'Unable to start analysis');
        }

        const smfContent = smfPages.map((page: any) => page.text ?? '').join(' ');
        const charges = await upsertCharges(supabase, matter.workspace_id, matter.id, [
                { content: smfContent, source_page_id: smfPages[0]?.id },
        ]);

        const summary =
                'The Statement of Material Facts describes alleged conduct. This summary restates the documents without offering advice or predictions.';
        const uncertainties = matter.smf_detected ? [] : ['SMF confidence is low'];
        const keyDates = ['Dates will be highlighted once OCR text is available.'];
        const clarifications = ['Use chat to ask neutral questions about the materials.'];
        const generalInfo = knowledgeBase.map((entry) => `Source: Knowledge Base — ${entry.title}. ${entry.body}`);

        const payload = {
                charges,
                summary,
                uncertainties,
                keyDates,
                clarifications,
                generalInfo,
        };

        await supabase
                .from('analysis_results')
                .insert({
                        workspace_id: matter.workspace_id,
                        matter_id: matter.id,
                        job_id: analysisJob.id,
                        payload,
                        summary,
                });

        await supabase
                .from('analysis_jobs')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', analysisJob.id);

        await supabase
                .from('matters')
                .update({ status: 'ready', smf_detected: true, smf_confidence: 0.6 })
                .eq('id', matter.id);

        await logAudit(supabase, matter.workspace_id, session.user.id, 'analysis_completed', {
                matter_id: matter.id,
                analysis_job_id: analysisJob.id,
        });

        return json({
                summary,
                charges,
                uncertainties,
                keyDates,
                clarifications,
                generalInfo,
                suggestedQuestions: buildSuggestedQuestions(charges, uncertainties),
        });
};
