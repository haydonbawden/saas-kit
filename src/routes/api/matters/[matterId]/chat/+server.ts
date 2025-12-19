import { error, json } from '@sveltejs/kit';
import { buildSuggestedQuestions, knowledgeBase } from '$lib/server/analysis';
import { assertMatterAccess, logAudit } from '$lib/server/workspaces';

export const POST = async ({ params, request, locals }) => {
        const { session } = await locals.safeGetSession();
        if (!session) throw error(401, 'Sign in required');
        const matterId = params.matterId;
        const supabase = locals.supabase as any;
        const matter = await assertMatterAccess(supabase, matterId);

        const body = await request.json();
        const content = (body?.message as string) || '';
        const conversationId = body?.conversationId as string | undefined;
        if (!content) {
                throw error(400, 'Message required');
        }

        let convoId = conversationId;
        if (!convoId) {
                const { data: conversation, error: conversationError } = await supabase
                        .from('conversations')
                        .insert({
                                workspace_id: matter.workspace_id,
                                matter_id: matter.id,
                                created_by: session.user.id,
                                title: 'Matter chat',
                        })
                        .select('*')
                        .single();
                if (conversationError || !conversation) {
                        throw error(500, conversationError?.message ?? 'Unable to start conversation');
                }
                convoId = conversation.id;
        }

        await supabase
                .from('messages')
                .insert({
                        workspace_id: matter.workspace_id,
                        matter_id: matter.id,
                        conversation_id: convoId,
                        role: 'user',
                        content,
                });

        const { data: analysis } = await supabase
                .from('analysis_results')
                .select('*')
                .eq('matter_id', matter.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

        const kbSnippet = knowledgeBase
                .map((entry) => `Source: Knowledge Base — ${entry.title}. ${entry.body}`)
                .join(' ');
        const chargeDescription =
                analysis?.payload?.charges?.map((charge: any) => `${charge.title}: ${charge.description ?? 'General description.'}`).join(' ')
                ?? 'Charges will be summarised once analysis runs.';

        const assistantContent = [
                'Here is neutral information based on your uploaded materials.',
                chargeDescription,
                analysis?.payload?.summary ?? 'We will summarise the Statement of Material Facts once OCR completes.',
                kbSnippet,
                'This is general information only and not legal advice.',
        ].join('\n\n');

        const { data: assistantMsg, error: assistantError } = await supabase
                .from('messages')
                .insert({
                        workspace_id: matter.workspace_id,
                        matter_id: matter.id,
                        conversation_id: convoId,
                        role: 'assistant',
                        content: assistantContent,
                        metadata: { sources: ['smf', 'knowledge-base'] },
                })
                .select('*')
                .single();
        if (assistantError || !assistantMsg) {
                throw error(500, assistantError?.message ?? 'Failed to respond');
        }

        await logAudit(supabase, matter.workspace_id, session.user.id, 'message_sent', {
                matter_id: matter.id,
                conversation_id: convoId,
        });

        const suggestedQuestions = buildSuggestedQuestions(
                analysis?.payload?.charges ?? [],
                analysis?.payload?.uncertainties ?? [],
        );

        return json({
                conversationId: convoId,
                reply: assistantMsg,
                suggestedQuestions,
        });
};
