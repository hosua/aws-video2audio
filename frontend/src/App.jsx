import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { VideoUploadDialog } from "@/pages/VideoUploadDialog";

const App = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex min-h-svh flex-col items-center justify-center gap-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold">video2audio Transcriber</h1>
        </header>
        <VideoUploadDialog />
      </div>
      <Toaster />
    </ThemeProvider>
  );
};

export default App;
