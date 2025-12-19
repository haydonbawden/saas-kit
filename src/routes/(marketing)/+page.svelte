<script lang="ts">
        import UploadFlow from './components/upload-flow.svelte';
        import { Button } from '$lib/components/ui/button';
        import { Card, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
        import { Separator } from '$lib/components/ui/separator';
        import { WebsiteName } from './../../config';
        import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
        import { CheckCircle2, FileText, Info, MessageSquare, Shield } from 'lucide-svelte';

        export let data;

        const { session } = data;
</script>

<svelte:head>
        <title>{WebsiteName} — Upload Prosecution Documents</title>
        <meta
                name="description"
                content="Mobile-first capture of prosecution documents for Western Australia matters. Upload photos, detect SMF, and receive general information only."
        />
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <section class="space-y-8">
                <div class="space-y-4">
                        <p class="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-300">Western Australia focus</p>
                        <h1 class="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                                Upload prosecution documents and get structured, general information
                        </h1>
                        <p class="max-w-3xl text-base text-slate-200">
                                {#if session}
                                        Welcome back. Start a new matter by capturing the Statement of Material Facts (SMF) and any
                                        other prosecution documents. The system will block analysis until SMF is detected.
                                {:else}
                                        You can pick files first. We'll ask you to sign in before uploading so your matter stays secure
                                        and tenant-scoped.
                                {/if}
                        </p>
                        <Alert class="bg-slate-900/70 text-slate-100">
                                <Shield class="h-4 w-4" />
                                <AlertTitle>General information only</AlertTitle>
                                <AlertDescription>
                                        The service explains charges and highlights uncertainties using your documents and a curated
                                        knowledge base. It never provides legal advice, strategy, or predictions.
                                </AlertDescription>
                        </Alert>
                </div>
                <UploadFlow {session} />
        </section>

        <section class="space-y-8">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                        <div class="space-y-2">
                                <h2 class="text-2xl font-semibold text-slate-50">What happens after upload</h2>
                                <p class="text-slate-200">
                                        The pipeline enforces SMF presence, identifies charges, and shares general information before chat or export.
                                </p>
                        </div>
                        <Button variant="secondary" href={session ? '/app' : '/login'}>
                                {session ? 'Go to dashboard' : 'Sign in to continue'}
                        </Button>
                </div>
                <div class="grid gap-4 lg:grid-cols-3">
                        <Card class="bg-slate-950/80 text-slate-50">
                                <CardHeader>
                                        <CardTitle class="flex items-center gap-2 text-lg">
                                                <FileText class="h-5 w-5 text-emerald-300" />
                                                OCR & SMF enforcement
                                        </CardTitle>
                                        <CardDescription class="text-slate-200">
                                                Each page is OCR'd. If SMF text is missing, we stop and prompt you to add SMF pages before analysis.
                                        </CardDescription>
                                </CardHeader>
                        </Card>
                        <Card class="bg-slate-950/80 text-slate-50">
                                <CardHeader>
                                        <CardTitle class="flex items-center gap-2 text-lg">
                                                <Info class="h-5 w-5 text-amber-300" />
                                                Pre-login teaser
                                        </CardTitle>
                                        <CardDescription class="text-slate-200">
                                                After OCR, we surface a neutral list of apparent charges and document types. No advice or next steps.
                                        </CardDescription>
                                </CardHeader>
                        </Card>
                        <Card class="bg-slate-950/80 text-slate-50">
                                <CardHeader>
                                        <CardTitle class="flex items-center gap-2 text-lg">
                                                <MessageSquare class="h-5 w-5 text-sky-300" />
                                                Chat & export
                                        </CardTitle>
                                        <CardDescription class="text-slate-200">
                                                Once signed in, ask questions, receive grounded answers, and generate the "Initial Information Letter" PDF with required disclaimer text.
                                        </CardDescription>
                                </CardHeader>
                        </Card>
                </div>
        </section>

        <section class="space-y-6 rounded-2xl bg-slate-950/70 p-6 ring-1 ring-slate-800">
                <div class="space-y-2">
                        <h2 class="text-2xl font-semibold text-slate-50">Why the Statement of Material Facts is required</h2>
                        <p class="text-slate-200">
                                SMF pages anchor all analysis. Without them, the system blocks processing and asks you to add SMF pages
                                via camera or file upload. This keeps summaries grounded in what the prosecution alleges.
                        </p>
                </div>
                <div class="grid gap-4 md:grid-cols-3">
                        <div class="space-y-2 rounded-xl bg-slate-900/60 p-4">
                                <CheckCircle2 class="h-5 w-5 text-emerald-300" />
                                <p class="text-sm font-semibold text-slate-50">Server-side checks</p>
                                <p class="text-sm text-slate-200">Analysis endpoints refuse to run unless SMF text is present.</p>
                        </div>
                        <div class="space-y-2 rounded-xl bg-slate-900/60 p-4">
                                <FileText class="h-5 w-5 text-emerald-300" />
                                <p class="text-sm font-semibold text-slate-50">Automatic detection</p>
                                <p class="text-sm text-slate-200">
                                        Headings like "Statement of Material Facts" are detected during OCR before any charge identification.
                                </p>
                        </div>
                        <div class="space-y-2 rounded-xl bg-slate-900/60 p-4">
                                <Info class="h-5 w-5 text-amber-300" />
                                <p class="text-sm font-semibold text-slate-50">Graceful fallback</p>
                                <p class="text-sm text-slate-200">
                                        If confidence is low, we still highlight uncertainty and let you add more SMF pages before continuing.
                                </p>
                        </div>
                </div>
                <Separator class="border-slate-800" />
                <div class="space-y-3">
                        <h3 class="text-lg font-semibold text-slate-50">Suggested questions you'll see later</h3>
                        <p class="text-sm text-slate-200">
                                Once analysis completes, we propose tap-to-send prompts like "What parts of the Statement of Material Facts were most important?" and "What information seems unclear or missing?" — always framed as questions only.
                        </p>
                </div>
        </section>

        <section class="grid gap-4 rounded-2xl bg-slate-950/70 p-6 ring-1 ring-slate-800 md:grid-cols-2">
                <div class="space-y-3">
                        <h2 class="text-2xl font-semibold text-slate-50">Ready to finalise initial advice?</h2>
                        <p class="text-slate-200">
                                After chat and analysis, you can generate the "Initial Information Letter" as a PDF. It auto-downloads and is stored per matter at
                                <code class="rounded bg-slate-900 px-2 py-1 text-xs">workspace_id/matter_id/exports/initial_information_letter_{'{timestamp}'}.pdf</code>.
                                The PDF contains the required disclaimer and cites SMF pages and knowledge base sources.
                        </p>
                        <div class="flex flex-wrap gap-3">
                                <Button variant="secondary" href={session ? '/app' : '/login'}>
                                        {session ? 'Open a matter' : 'Sign in to start'}
                                </Button>
                                <Button variant="outline" href="/contact">Speak with the team</Button>
                        </div>
                </div>
                <div class="space-y-3 rounded-xl bg-slate-900/70 p-4">
                        <div class="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                                <Shield class="h-4 w-4" /> Workspace-first storage
                        </div>
                        <p class="text-sm text-slate-200">
                                Matters, documents, pages, embeddings, conversations, and exports are all scoped to workspaces with RLS enforced across tables.
                        </p>
                        <div class="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                                <MessageSquare class="h-4 w-4" /> Grounded responses
                        </div>
                        <p class="text-sm text-slate-200">
                                Chat answers cite SMF excerpts for facts and a curated knowledge base for general explanations, avoiding advice or predictions.
                        </p>
                </div>
        </section>
</div>
