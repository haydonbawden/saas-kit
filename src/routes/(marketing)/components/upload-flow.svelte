<script lang="ts">
        import { Button } from '$lib/components/ui/button';
        import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
        import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
        import {
                Drawer,
                DrawerClose,
                DrawerContent,
                DrawerDescription,
                DrawerFooter,
                DrawerHeader,
                DrawerTitle,
                DrawerTrigger,
        } from '$lib/components/ui/drawer';
        import { Separator } from '$lib/components/ui/separator';
        import { cn } from '$lib/utils';
        import {
                Camera,
                CheckCircle2,
                FileText,
                Info,
                Loader2,
                LogIn,
                ShieldCheck,
                Upload,
                X,
        } from 'lucide-svelte';
        import { onDestroy } from 'svelte';

        export let session: { user?: { email?: string | null; user_metadata?: Record<string, unknown> } } | null = null;

        type LocalFile = {
                file: File;
                previewUrl: string;
        };

        let showPicker = false;
        let showAuthDialog = false;
        let files: LocalFile[] = [];
        let cameraInput: HTMLInputElement | null = null;
        let fileInput: HTMLInputElement | null = null;
        let statusMessage = '';
        let uploadComplete = false;
        let working = false;
        let createdMatterId: string | null = null;
        let teaserCharges: { title: string; description?: string }[] = [];

        const cleanupUrls = () => {
                files.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        };

        onDestroy(cleanupUrls);

        const handleFiles = (fileList: FileList | null) => {
                if (!fileList?.length) return;
                const nextFiles = Array.from(fileList).map((file) => ({
                        file,
                        previewUrl: URL.createObjectURL(file),
                }));
                cleanupUrls();
                files = nextFiles;
                uploadComplete = false;
                statusMessage = '';
        };

        const handleRemove = (name: string) => {
                const filtered = files.filter(({ file }) => file.name !== name);
                cleanupUrls();
                files = filtered.map((entry) => ({ ...entry, previewUrl: URL.createObjectURL(entry.file) }));
                uploadComplete = false;
        };

        const triggerPicker = (mode: 'camera' | 'file') => {
                if (mode === 'camera') {
                        cameraInput?.click();
                        return;
                }
                fileInput?.click();
        };

        const submitUpload = async () => {
                if (!files.length) {
                        statusMessage = 'Add photos or PDFs first.';
                        return;
                }
                if (!session) {
                        showAuthDialog = true;
                        teaserCharges = files.map(({ file }) => ({
                                title: file.name,
                                description: 'Charge preview based on filename only. Full OCR runs after login.',
                        }));
                        return;
                }
                working = true;
                statusMessage = 'Uploading securely and preparing your matter...';
                const form = new FormData();
                files.forEach(({ file }) => form.append('files', file));
                form.append('title', `Mobile upload ${new Date().toLocaleString()}`);
                const response = await fetch('/api/matters', { method: 'POST', body: form });
                if (!response.ok) {
                        statusMessage = 'Upload failed. Please try again after signing in.';
                        working = false;
                        return;
                }
                const payload = await response.json();
                createdMatterId = payload.matterId;
                teaserCharges = payload.charges ?? [];
                statusMessage = payload.smfFound
                        ? 'SMF detected. You can continue to chat and export after analysis.'
                        : 'SMF not detected yet. Add SMF pages after signing in.';
                uploadComplete = true;
                working = false;
        };

        const isSmfPresent = () => {
                return files.some(({ file }) => /smf|statement of material facts/i.test(file.name));
        };
</script>

<Card class="border-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white shadow-xl">
        <CardHeader class="space-y-4">
                <CardTitle class="text-3xl font-semibold leading-tight text-white">
                        Upload Prosecution Documents
                </CardTitle>
                <CardDescription class="text-slate-200">
                        Capture photos or upload PDFs. Include the Statement of Material Facts (SMF) for each
                        offence so we can extract neutral, structured information.
                </CardDescription>
                <div class="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-200">
                        <ShieldCheck class="h-4 w-4 text-emerald-300" />
                        <p class="leading-snug">
                                Files stay local until you confirm. Analysis runs only after secure upload and SMF
                                detection.
                        </p>
                </div>
        </CardHeader>
        <CardContent class="space-y-6">
                <div class="grid gap-3 rounded-2xl bg-slate-900/40 p-4 sm:grid-cols-2">
                        <div class="space-y-3">
                                <p class="text-sm font-semibold uppercase tracking-wide text-slate-300">
                                        Start with photos
                                </p>
                                <p class="text-sm text-slate-200">
                                        Use your camera for the fastest capture. We accept multiple pages and combine
                                        them into one matter automatically.
                                </p>
                                <div class="flex gap-3">
                                        <Drawer bind:open={showPicker}>
                                                <DrawerTrigger asChild>
                                                        <Button class="flex-1" size="lg" variant="secondary">
                                                                <Upload class="mr-2 h-4 w-4" />
                                                                Upload prosecution documents
                                                        </Button>
                                                </DrawerTrigger>
                                                <DrawerContent class="pb-8">
                                                        <DrawerHeader class="space-y-1">
                                                                <DrawerTitle>Choose how to add documents</DrawerTitle>
                                                                <DrawerDescription>
                                                                        You can add multiple photos or PDFs. SMF pages are required before
                                                                        analysis can start.
                                                                </DrawerDescription>
                                                        </DrawerHeader>
                                                        <div class="space-y-3 px-6">
                                                                <Button
                                                                        class="w-full justify-start"
                                                                        size="lg"
                                                                        variant="secondary"
                                                                        on:click={() => triggerPicker('camera')}
                                                                >
                                                                        <Camera class="mr-2 h-5 w-5" /> Take photos (recommended)
                                                                </Button>
                                                                <Button
                                                                        class="w-full justify-start"
                                                                        size="lg"
                                                                        variant="outline"
                                                                        on:click={() => triggerPicker('file')}
                                                                >
                                                                        <FileText class="mr-2 h-5 w-5" /> Upload files or photos
                                                                </Button>
                                                                <input
                                                                        class="hidden"
                                                                        bind:this={cameraInput}
                                                                        type="file"
                                                                        accept="image/*"
                                                                        capture="environment"
                                                                        multiple
                                                                        on:change={(event) => handleFiles(event.currentTarget.files)}
                                                                />
                                                                <input
                                                                        class="hidden"
                                                                        bind:this={fileInput}
                                                                        type="file"
                                                                        accept="image/*,.pdf"
                                                                        multiple
                                                                        on:change={(event) => handleFiles(event.currentTarget.files)}
                                                                />
                                                        </div>
                                                        <DrawerFooter>
                                                                <DrawerClose asChild>
                                                                        <Button variant="ghost">Close</Button>
                                                                </DrawerClose>
                                                        </DrawerFooter>
                                                </DrawerContent>
                                        </Drawer>
                                </div>
                        </div>
                        <div class="space-y-4 rounded-xl bg-slate-950/50 p-4 ring-1 ring-slate-800">
                                <div class="flex items-center justify-between text-sm font-semibold text-slate-200">
                                        <span>Selected files</span>
                                        <span class="rounded-full bg-slate-800 px-3 py-1 text-xs">{files.length}</span>
                                </div>
                                {#if files.length === 0}
                                        <p class="text-sm text-slate-300">No files yet. Add SMF pages first.</p>
                                {:else}
                                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                {#each files as { file, previewUrl }}
                                                        <div class="group relative overflow-hidden rounded-xl bg-slate-800/70 p-3">
                                                                {#if file.type.includes('pdf')}
                                                                        <div class="flex h-24 items-center justify-center rounded-lg bg-slate-900">
                                                                                <FileText class="h-8 w-8 text-slate-200" />
                                                                        </div>
                                                                {:else}
                                                                        <img
                                                                                alt={file.name}
                                                                                src={previewUrl}
                                                                                class="h-24 w-full rounded-lg object-cover"
                                                                        />
                                                                {/if}
                                                                <button
                                                                        type="button"
                                                                        class="absolute right-2 top-2 rounded-full bg-slate-900/80 p-1 text-slate-100 shadow"
                                                                        on:click={() => handleRemove(file.name)}
                                                                >
                                                                        <X class="h-4 w-4" />
                                                                        <span class="sr-only">Remove</span>
                                                                </button>
                                                                <p class="mt-2 line-clamp-2 text-xs text-slate-100">{file.name}</p>
                                                        </div>
                                                {/each}
                                        </div>
                                {/if}
                                <div class={cn('rounded-lg p-3 text-sm', isSmfPresent() ? 'bg-emerald-900/40 text-emerald-100' : 'bg-amber-900/30 text-amber-100')}>
                                        <div class="flex items-center gap-2">
                                                <Info class="h-4 w-4" />
                                                <span class="font-semibold">Statement of Material Facts</span>
                                        </div>
                                        <p class="mt-1 leading-snug">
                                                {#if isSmfPresent()}
                                                        SMF likely detected from file names. The pipeline will verify during OCR.
                                                {:else}
                                                        We must find SMF content before analysis. If missing, you will be prompted to add those pages.
                                                {/if}
                                        </p>
                                </div>
                        </div>
                </div>
                <Separator class="border-slate-800" />
                <div class="grid gap-4 sm:grid-cols-3">
                        <div class="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-slate-800">
                                <div class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                        <Camera class="h-4 w-4" /> Capture pages
                                </div>
                                <p class="mt-2 text-sm text-slate-200">
                                        Combine photos and PDFs. Each page is OCR'd and stored with workspace scoping.
                                </p>
                        </div>
                        <div class="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-slate-800">
                                <div class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                        <CheckCircle2 class="h-4 w-4" /> Detect SMF
                                </div>
                                <p class="mt-2 text-sm text-slate-200">
                                        The system blocks analysis until SMF text is found. You can add missing pages at any time.
                                </p>
                        </div>
                        <div class="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-slate-800">
                                <div class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                        <Info class="h-4 w-4" /> Neutral insights
                                </div>
                                <p class="mt-2 text-sm text-slate-200">
                                        Receive general information about detected charges, never advice or predictions.
                                </p>
                        </div>
                </div>
        </CardContent>
        <CardFooter class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div class="text-sm text-slate-200">
                                {#if statusMessage}
                                        <div class="flex items-center gap-2">
                                                {#if working}
                                                        <Loader2 class="h-4 w-4 animate-spin" />
                                                {/if}
                                                <span>{statusMessage}</span>
                                        </div>
                                        {#if createdMatterId}
                                                <div class="mt-2 flex flex-wrap gap-2">
                                                        <Button size="sm" href={`/app/matters/${createdMatterId}`}>Open matter</Button>
                                                        <Button size="sm" variant="outline" href="/app">Go to dashboard</Button>
                                                </div>
                                        {/if}
                                {:else}
                                        <p>Ready when you are. Tap done to continue.</p>
                                {/if}
                        </div>
                <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button variant="ghost" class="w-full sm:w-auto" on:click={() => (files = [])}>
                                Clear selection
                        </Button>
                        <Button class="w-full sm:w-auto" size="lg" on:click={submitUpload} disabled={working}>
                                {uploadComplete ? 'Continue in app' : 'Done'}
                        </Button>
                </div>
        </CardFooter>
</Card>

<Dialog bind:open={showAuthDialog}>
        <DialogContent class="sm:max-w-md">
                <DialogHeader>
                        <DialogTitle>Sign in to upload securely</DialogTitle>
                        <DialogDescription>
                                We need an account to create your workspace and store your matter. You can finish sign-in
                                and we will continue uploading automatically.
                        </DialogDescription>
                </DialogHeader>
                <div class="space-y-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                        <div class="flex items-center gap-2">
                                <LogIn class="h-4 w-4" />
                                <p>Uploads are staged locally until you sign in.</p>
                        </div>
                        <div class="flex items-center gap-2">
                                <ShieldCheck class="h-4 w-4" />
                                <p>SMF content is mandatory before analysis proceeds.</p>
                        </div>
                </div>
                <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button class="w-full sm:w-auto" variant="secondary" href="/login">
                                Go to login
                        </Button>
                        <Button class="w-full sm:w-auto" variant="outline" href="/register">
                                Create account
                        </Button>
                        <Button class="w-full sm:w-auto" variant="ghost" on:click={() => (showAuthDialog = false)}>
                                Keep editing
                        </Button>
                </DialogFooter>
        </DialogContent>
</Dialog>
