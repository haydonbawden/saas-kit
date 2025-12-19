<script lang="ts">
        import { Button } from '$lib/components/ui/button';
        import { Badge } from '$lib/components/ui/badge';
        import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
        import { Separator } from '$lib/components/ui/separator';
        import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
        import { goto } from '$app/navigation';
        import type { PageData } from './$types';
        import { Camera, FileText, Loader2, Upload } from 'lucide-svelte';

        export let data: PageData;

        let files: File[] = [];
        let statusMessage = '';
        let uploading = false;
        let previewCharges: { title: string; description?: string }[] = [];

        const handleFiles = (selected: FileList | null) => {
                files = selected ? Array.from(selected) : [];
                previewCharges = files.map((file) => ({
                        title: file.name,
                        description: 'Charge preview will appear after OCR.',
                }));
        };

        const createMatter = async () => {
                if (!files.length) {
                        statusMessage = 'Add photos or PDFs first (include SMF).';
                        return;
                }
                uploading = true;
                statusMessage = 'Uploading securely and preparing your matter...';
                const form = new FormData();
                files.forEach((file) => form.append('files', file));
                form.append('title', `Matter ${new Date().toLocaleString()}`);
                const response = await fetch('/api/matters', {
                        method: 'POST',
                        body: form,
                });
                if (!response.ok) {
                        statusMessage = 'Unable to upload. Please ensure you are signed in and try again.';
                        uploading = false;
                        return;
                }
                const payload = await response.json();
                statusMessage = payload.smfFound
                        ? 'Upload complete. SMF detected, you can continue to analysis.'
                        : 'Upload complete but SMF still required. Add SMF pages before analysis.';
                previewCharges = payload.charges ?? [];
                uploading = false;
                goto(`/app/matters/${payload.matterId}`);
        };

        const startAnalysis = async (matterId: string, smfDetected: boolean) => {
                if (!smfDetected) {
                        statusMessage = 'SMF required before analysis can begin.';
                        return;
                }
                const response = await fetch(`/api/matters/${matterId}/analysis`, { method: 'POST' });
                if (!response.ok) {
                        statusMessage = 'Analysis could not start. Ensure SMF is present.';
                        return;
                }
                const payload = await response.json();
                statusMessage = 'Analysis completed. You can open the matter to chat and export the PDF.';
                goto(`/app/matters/${matterId}`);
        };
</script>

<svelte:head>
        <title>Matters dashboard</title>
</svelte:head>

<div class="flex w-full flex-col gap-6">
        <div class="flex flex-col gap-3">
                <h1 class="text-2xl font-semibold">{data.workspace?.name ?? 'Workspace'}</h1>
                <p class="text-sm text-muted-foreground">
                        Capture prosecution documents, enforce Statement of Material Facts presence, and generate general information only.
                </p>
        </div>

        <Card class="border border-slate-200/50 bg-white">
                <CardHeader class="space-y-2">
                        <CardTitle class="flex items-center gap-2 text-lg">
                                <Upload class="h-4 w-4" /> Upload prosecution documents
                        </CardTitle>
                        <CardDescription>Photos and PDFs are accepted. SMF is mandatory before analysis.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                        <div class="grid gap-4 md:grid-cols-3">
                                <label
                                        class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-slate-500"
                                >
                                        <Camera class="h-6 w-6 text-slate-700" />
                                        <div class="text-sm font-semibold">Take photos (recommended)</div>
                                        <input
                                                class="hidden"
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                aria-label="Upload images"
                                                capture="environment"
                                                on:change={(event) => handleFiles(event.currentTarget.files)}
                                        />
                                </label>
                                <label
                                        class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-slate-500"
                                >
                                        <FileText class="h-6 w-6 text-slate-700" />
                                        <div class="text-sm font-semibold">Upload files or PDFs</div>
                                        <input
                                                class="hidden"
                                                type="file"
                                                accept="image/*,.pdf"
                                                multiple
                                                aria-label="Upload files or PDFs"
                                                on:change={(event) => handleFiles(event.currentTarget.files)}
                                        />
                                </label>
                                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                        <p class="font-semibold">SMF enforcement</p>
                                        <p class="mt-1 leading-snug">
                                                Analysis will refuse to run until Statement of Material Facts text is detected. Add SMF pages now to avoid delays.
                                        </p>
                                </div>
                        </div>
                        {#if files.length > 0}
                                <div class="space-y-2 rounded-xl bg-slate-50 p-4">
                                        <div class="flex items-center justify-between text-sm font-semibold text-slate-700">
                                                <span>Selected files</span>
                                                <Badge variant="secondary">{files.length}</Badge>
                                        </div>
                                        <div class="grid gap-3 sm:grid-cols-3">
                                                {#each files as file}
                                                        <div class="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                                                <p class="line-clamp-2 font-medium">{file.name}</p>
                                                                <p class="text-xs text-muted-foreground">Type: {file.type || 'unknown'}</p>
                                                        </div>
                                                {/each}
                                        </div>
                                        <div class="space-y-1 text-xs text-slate-600">
                                                <p class="font-semibold">Local teaser (pre-login)</p>
                                                <p>
                                                        We estimate apparent charges based on filenames only. Full OCR runs after upload.
                                                </p>
                                                <ul class="list-disc pl-4">
                                                        {#each previewCharges as charge}
                                                                <li>{charge.title}</li>
                                                        {/each}
                                                </ul>
                                        </div>
                                </div>
                        {/if}
                </CardContent>
                <CardFooter class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div class="text-sm text-slate-700">
                                {#if statusMessage}
                                        <div class="flex items-center gap-2">
                                                {#if uploading}
                                                        <Loader2 class="h-4 w-4 animate-spin" />
                                                {/if}
                                                <span>{statusMessage}</span>
                                        </div>
                                {:else}
                                        Ready when you are. Add SMF first to avoid delays.
                                {/if}
                        </div>
                        <div class="flex flex-wrap gap-3">
                                <Button variant="outline" on:click={() => (files = [])}>Clear selection</Button>
                                <Button on:click={createMatter} disabled={uploading}>
                                        {#if uploading}
                                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                        {/if}
                                        Upload & continue
                                </Button>
                        </div>
                </CardFooter>
        </Card>

        <Separator />

        <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                                <h2 class="text-xl font-semibold">Matters</h2>
                                <p class="text-sm text-muted-foreground">SMF must be present before analysis. Click a matter to continue.</p>
                        </div>
                        <Button variant="secondary" href="/app">Refresh</Button>
                </div>
                {#if data.matters.length === 0}
                        <Alert>
                                <AlertTitle>No matters yet</AlertTitle>
                                <AlertDescription>Upload documents to create your first matter.</AlertDescription>
                        </Alert>
                {:else}
                        <div class="grid gap-4 md:grid-cols-2">
                                {#each data.matters as matter}
                                        <Card class="bg-white">
                                                <CardHeader>
                                                        <div class="flex items-center justify-between gap-2">
                                                                <div class="space-y-1">
                                                                        <CardTitle class="text-base">{matter.title}</CardTitle>
                                                                        <CardDescription>Created {new Date(matter.created_at).toLocaleString()}</CardDescription>
                                                                </div>
                                                                <Badge variant={matter.smf_detected ? 'default' : 'destructive'}>
                                                                        {matter.status}
                                                                </Badge>
                                                        </div>
                                                </CardHeader>
                                                <CardContent class="space-y-3">
                                                        <div class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                                                                <p class="font-semibold">Statement of Material Facts</p>
                                                                <p class="text-sm leading-snug">
                                                                        {matter.smf_detected
                                                                                ? 'Detected. Analysis can proceed.'
                                                                                : 'Not detected yet. Add SMF pages before analysis.'}
                                                                </p>
                                                        </div>
                                                        <div class="space-y-2">
                                                                <p class="text-sm font-semibold">Apparent charges</p>
                                                                {#if matter.charges.length === 0}
                                                                        <p class="text-sm text-muted-foreground">Charges will appear after OCR.</p>
                                                                {:else}
                                                                        <ul class="space-y-1 text-sm text-slate-700">
                                                                                {#each matter.charges as charge}
                                                                                        <li class="flex items-start gap-2">
                                                                                                <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                                                                                                <div>
                                                                                                        <p class="font-medium">{charge.title}</p>
                                                                                                        <p class="text-xs text-muted-foreground">{charge.description}</p>
                                                                                                </div>
                                                                                        </li>
                                                                                {/each}
                                                                        </ul>
                                                                {/if}
                                                        </div>
                                                </CardContent>
                                                <CardFooter class="flex flex-wrap gap-2">
                                                        <Button variant="secondary" href={`/app/matters/${matter.id}`}>
                                                                Open
                                                        </Button>
                                                        <Button
                                                                variant="outline"
                                                                disabled={!matter.smf_detected}
                                                                on:click={() => startAnalysis(matter.id, matter.smf_detected)}
                                                        >
                                                                Start analysis
                                                        </Button>
                                                </CardFooter>
                                        </Card>
                                {/each}
                        </div>
                {/if}
        </div>
</div>
