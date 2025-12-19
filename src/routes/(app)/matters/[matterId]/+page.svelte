<script lang="ts">
        import { Button } from '$lib/components/ui/button';
        import { Badge } from '$lib/components/ui/badge';
        import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
        import { Textarea } from '$lib/components/ui/textarea';
        import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
        import { cn } from '$lib/utils';
        import { goto } from '$app/navigation';
        import type { PageData } from './$types';
        import { CheckCircle2, FileUp, Loader2, MessageSquare } from 'lucide-svelte';

        export let data: PageData & {
                messages: any[];
                analysis: any;
                charges: any[];
                extractedPages: any[];
                exports: any[];
        };

        let localFiles: File[] = [];
        let cameraInput: HTMLInputElement | null = null;
        let fileInput: HTMLInputElement | null = null;
        let sending = false;
        let chatMessage = '';
        let conversationId: string | undefined = data.messages[0]?.conversation_id;
        let statusMessage = '';

        const handleLocalFiles = (fileList: FileList | null) => {
                localFiles = fileList ? Array.from(fileList) : [];
        };

        const uploadMore = async (filesArg?: FileList | File[]) => {
                const files = filesArg ? Array.from(filesArg) : localFiles;
                if (!files.length) {
                        statusMessage = 'Add files first.';
                        return;
                }
                const form = new FormData();
                files.forEach((file) => form.append('files', file));
                const response = await fetch(`/api/matters/${data.matter.id}/upload`, { method: 'POST', body: form });
                if (!response.ok) {
                        statusMessage = 'Upload failed. Ensure you are signed in and try again.';
                        return;
                }
                statusMessage = 'Files uploaded. SMF detection will update shortly.';
                localFiles = [];
                goto(`/app/matters/${data.matter.id}`);
        };

        const triggerSmfUpload = (mode: 'camera' | 'file') => {
                if (mode === 'camera') {
                        cameraInput?.click();
                        return;
                }
                fileInput?.click();
        };

        const runAnalysis = async () => {
                const response = await fetch(`/api/matters/${data.matter.id}/analysis`, { method: 'POST' });
                if (!response.ok) {
                        statusMessage = 'Analysis blocked until SMF is present.';
                        return;
                }
                statusMessage = 'Analysis complete. Scroll for results and chat.';
                goto(`/app/matters/${data.matter.id}`);
        };

        const sendMessage = async () => {
                if (!chatMessage.trim()) return;
                sending = true;
                const response = await fetch(`/api/matters/${data.matter.id}/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ conversationId, message: chatMessage }),
                });
                chatMessage = '';
                sending = false;
                if (!response.ok) {
                        statusMessage = 'Unable to send message right now.';
                        return;
                }
                const payload = await response.json();
                conversationId = payload.conversationId;
                goto(`/app/matters/${data.matter.id}`);
        };

        const exportLetter = async () => {
                const response = await fetch(`/api/matters/${data.matter.id}/export`, { method: 'POST' });
                if (!response.ok) {
                        statusMessage = 'Export failed. Run analysis first.';
                        return;
                }
                const payload = await response.json();
                if (payload.downloadUrl) {
                        window.location.href = payload.downloadUrl;
                        statusMessage = 'Initial Information Letter generated and downloading.';
                } else {
                        statusMessage = 'Unable to generate a download link.';
                }
        };

        const openExistingExport = async (path: string) => {
                const response = await fetch(`/api/matters/${data.matter.id}/export`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path }),
                });
                const payload = await response.json();
                if (payload.downloadUrl) {
                        window.open(payload.downloadUrl, '_blank');
                }
        };

        const analysisPayload = (data.analysis as any)?.payload ?? {};

        const suggestedQuestions = (() => {
                const questions = new Set<string>();
                data.charges.forEach((charge) => {
                        questions.add(`What does ${charge.title} generally mean in plain English?`);
                        questions.add(`What parts of the Statement of Material Facts relate to ${charge.title}?`);
                });
                (analysisPayload?.uncertainties ?? []).forEach((gap: string) => {
                        questions.add(`What is unclear or missing about ${gap}?`);
                });
                questions.add('Which sections of the Statement of Material Facts were most important?');
                questions.add('What information seems unclear or missing?');
                return Array.from(questions);
        })();
</script>

<svelte:head>
        <title>{data.matter?.title ?? 'Matter'}</title>
</svelte:head>

{#if !data.matter}
        <Alert>
                <AlertTitle>Matter not found</AlertTitle>
                <AlertDescription>Check your access and try again.</AlertDescription>
        </Alert>
{:else}
        <div class="flex flex-col gap-6 w-full">
                <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-3 flex-wrap">
                                <h1 class="text-2xl font-semibold">{data.matter.title}</h1>
                                <Badge variant={data.matter.smf_detected ? 'default' : 'destructive'}>{data.matter.status}</Badge>
                        </div>
                        <p class="text-sm text-muted-foreground">SMF detection is enforced before analysis. This workspace remains tenant-scoped.</p>
                        {#if statusMessage}
                                <div class="rounded-lg bg-slate-50 p-3 text-sm">{statusMessage}</div>
                        {/if}
                </div>

                <div class="grid gap-4 md:grid-cols-3">
                        <Card class="md:col-span-2">
                                <CardHeader>
                                        <CardTitle class="flex items-center gap-2">
                                                <CheckCircle2 class="h-4 w-4" /> Statement of Material Facts
                                        </CardTitle>
                                        <CardDescription>
                                                {data.matter.smf_detected
                                                        ? 'SMF detected. Analysis can proceed.'
                                                        : 'SMF not detected yet. Upload SMF pages to continue.'}
                                        </CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                        {#if data.extractedPages.length === 0}
                                                <p class="text-sm text-muted-foreground">No pages registered yet.</p>
                                        {:else}
                                                <ul class="space-y-2">
                                                        {#each data.extractedPages as page}
                                                                <li class={cn('rounded-lg border p-3 text-sm', page.is_smf ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200')}>
                                                                        <p class="text-xs text-muted-foreground">Page {page.id.slice(0, 6)} • {page.is_smf ? 'Possible SMF' : 'General page'}</p>
                                                                        <p class="mt-1 leading-snug">{page.text}</p>
                                                                </li>
                                                        {/each}
                                                </ul>
                                        {/if}
                                </CardContent>
                                <CardFooter class="flex flex-wrap gap-3">
                                        <label class="flex items-center gap-2 text-sm text-slate-700">
                                                <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*,.pdf"
                                                        aria-label="Add documents"
                                                        class="hidden"
                                                        on:change={(event) => handleLocalFiles(event.currentTarget.files)}
                                                />
                                                <span class="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2">
                                                        <FileUp class="h-4 w-4" /> Add documents
                                                </span>
                                        </label>
                                        <Button variant="secondary" on:click={() => uploadMore()} disabled={localFiles.length === 0}>Upload selection</Button>
                                        <Button on:click={runAnalysis} disabled={!data.matter.smf_detected}>Run analysis</Button>
                                </CardFooter>
                        </Card>
                        <Card>
                                <CardHeader>
                                        <CardTitle>Apparent charges</CardTitle>
                                        <CardDescription>Neutral descriptions only.</CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-2">
                                        {#if data.charges.length === 0}
                                                <p class="text-sm text-muted-foreground">Charges will appear after OCR/analysis.</p>
                                        {:else}
                                                {#each data.charges as charge}
                                                        <div class="rounded-lg bg-slate-50 p-3 text-sm">
                                                                <p class="font-semibold">{charge.title}</p>
                                                                <p class="text-xs text-muted-foreground">{charge.description}</p>
                                                        </div>
                                                {/each}
                                        {/if}
                                </CardContent>
                                <CardFooter class="flex flex-col gap-2">
                                        <Button variant="outline" on:click={exportLetter} disabled={!data.analysis}>Finalise Initial Advice</Button>
                                        <p class="text-xs text-muted-foreground">Downloads and stores the PDF with required disclaimer.</p>
                                </CardFooter>
                        </Card>
                </div>

                {#if !data.matter.smf_detected}
                        <Card class="border-amber-200 bg-amber-50">
                                <CardHeader>
                                        <CardTitle>Statement of Material Facts required</CardTitle>
                                        <CardDescription>
                                                We couldn’t find the Statement of Material Facts. Add SMF pages via camera or upload before analysis and chat unlock.
                                        </CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                        <p class="text-sm text-amber-900">
                                                Analysis, chat, and exports stay blocked until SMF text is present. Server checks enforce this even if you try to continue.
                                        </p>
                                        <div class="flex flex-wrap gap-3">
                                                <Button variant="secondary" on:click={() => triggerSmfUpload('camera')}>
                                                        Add SMF pages (camera)
                                                </Button>
                                                <Button variant="outline" on:click={() => triggerSmfUpload('file')}>
                                                        Upload more files
                                                </Button>
                                                <input
                                                        class="hidden"
                                                        bind:this={cameraInput}
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        capture="environment"
                                                        on:change={(event) => {
                                                                handleLocalFiles(event.currentTarget.files);
                                                                uploadMore(event.currentTarget.files ?? undefined);
                                                        }}
                                                />
                                                <input
                                                        class="hidden"
                                                        bind:this={fileInput}
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        multiple
                                                        on:change={(event) => {
                                                                handleLocalFiles(event.currentTarget.files);
                                                                uploadMore(event.currentTarget.files ?? undefined);
                                                        }}
                                                />
                                        </div>
                                </CardContent>
                                <CardFooter class="text-sm text-amber-900">
                                        We look for headings like “Statement of Material Facts” automatically after OCR. If confidence stays low, add clearer SMF pages.
                                </CardFooter>
                        </Card>
                {:else}
                        <Card>
                                <CardHeader>
                                        <CardTitle>Analysis results</CardTitle>
                                        <CardDescription>General, grounded summaries only.</CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                        {#if !data.analysis}
                                                <p class="text-sm text-muted-foreground">Run analysis after SMF is detected.</p>
                                        {:else}
                                                <div class="rounded-lg bg-slate-50 p-3 text-sm">
                                                        <p class="font-semibold">Summary</p>
                                                        <p class="text-sm leading-snug">{analysisPayload?.summary}</p>
                                                </div>
                                                <div class="grid gap-3 md:grid-cols-3">
                                                        <div class="rounded-lg bg-slate-50 p-3 text-sm">
                                                                <p class="font-semibold">Key dates</p>
                                                                <ul class="list-disc pl-4 text-xs text-muted-foreground">
                                                                        {#each analysisPayload?.keyDates ?? [] as date}
                                                                                <li>{date}</li>
                                                                        {:else}
                                                                                <li>Not identified.</li>
                                                                        {/each}
                                                                </ul>
                                                        </div>
                                                        <div class="rounded-lg bg-slate-50 p-3 text-sm">
                                                                <p class="font-semibold">Uncertainties</p>
                                                                <ul class="list-disc pl-4 text-xs text-muted-foreground">
                                                                        {#each analysisPayload?.uncertainties ?? [] as gap}
                                                                                <li>{gap}</li>
                                                                        {:else}
                                                                                <li>None flagged yet.</li>
                                                                        {/each}
                                                                </ul>
                                                        </div>
                                                        <div class="rounded-lg bg-slate-50 p-3 text-sm">
                                                                <p class="font-semibold">Knowledge Base</p>
                                                                <ul class="list-disc pl-4 text-xs text-muted-foreground">
                                                                        {#each analysisPayload?.generalInfo ?? [] as info}
                                                                                <li>{info}</li>
                                                                        {:else}
                                                                                <li>Knowledge base will appear after analysis.</li>
                                                                        {/each}
                                                                </ul>
                                                        </div>
                                                </div>
                                        {/if}
                                </CardContent>
                        </Card>

                        <Card>
                                <CardHeader>
                                        <CardTitle class="flex items-center gap-2"><MessageSquare class="h-4 w-4" /> Chat</CardTitle>
                                        <CardDescription>Ask neutral questions. Responses stay general and cite SMF / knowledge base.</CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                        <div class="space-y-2 max-h-96 overflow-y-auto">
                                                {#if data.messages.length === 0}
                                                        <p class="text-sm text-muted-foreground">No conversation yet. Ask a question to begin.</p>
                                                {:else}
                                                        {#each data.messages as message}
                                                                <div class={cn('rounded-lg p-3 text-sm', message.role === 'assistant' ? 'bg-slate-50' : 'bg-white border')}>
                                                                        <p class="text-xs uppercase text-muted-foreground">{message.role}</p>
                                                                        <p class="leading-snug whitespace-pre-line">{message.content}</p>
                                                                </div>
                                                        {/each}
                                                {/if}
                                        </div>
                                        <div class="grid gap-2 md:grid-cols-3">
                                                {#each suggestedQuestions.slice(0, 6) as question}
                                                        <button
                                                                type="button"
                                                                class="rounded-lg border border-dashed border-slate-300 p-3 text-left text-sm hover:border-slate-500"
                                                                on:click={() => (chatMessage = question)}
                                                        >
                                                                {question}
                                                        </button>
                                                {/each}
                                        </div>
                                </CardContent>
                                <CardFooter class="flex flex-col gap-2">
                                        <Textarea
                                                placeholder="Ask about the documents in neutral terms"
                                                value={chatMessage}
                                                on:input={(event) => (chatMessage = event.currentTarget.value)}
                                        />
                                        <div class="flex gap-2">
                                                <Button on:click={sendMessage} disabled={sending}>
                                                        {#if sending}
                                                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                                        {/if}
                                                        Send
                                                </Button>
                                                <Button variant="outline" on:click={() => (chatMessage = '')}>Clear</Button>
                                        </div>
                                </CardFooter>
                        </Card>

                        <Card>
                                <CardHeader>
                                        <CardTitle>Exports</CardTitle>
                                        <CardDescription>Latest Initial Information Letters.</CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-2">
                                        {#if data.exports.length === 0}
                                                <p class="text-sm text-muted-foreground">Generate an export after analysis.</p>
                                        {:else}
                                                <ul class="space-y-2 text-sm">
                                                        {#each data.exports as exp}
                                                                <li class="flex items-center justify-between rounded-lg border p-3">
                                                                        <div>
                                                                                <p class="font-semibold">{exp.metadata?.kind ?? 'Initial Information Letter'}</p>
                                                                                <p class="text-xs text-muted-foreground">{new Date(exp.created_at).toLocaleString()}</p>
                                                                        </div>
                                                                        <Button variant="outline" on:click={() => openExistingExport(exp.storage_path)}>
                                                                                Download
                                                                        </Button>
                                                                </li>
                                                        {/each}
                                                </ul>
                                        {/if}
                                </CardContent>
                        </Card>
                {/if}
        </div>
{/if}
