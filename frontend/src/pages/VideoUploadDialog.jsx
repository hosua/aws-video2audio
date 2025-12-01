import { useState, useCallback } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const UPLOAD_BUCKET = import.meta.env.VITE_UPLOAD_BUCKET_NAME;
const API_URL = import.meta.env.VITE_API_GATEWAY_URL;

const MAX_FILE_SIZE = 1073741824;

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".webm",
  ".mkv",
  ".m4v",
  ".3gp",
  ".ogv",
];

const isVideoFile = (file) => {
  if (file.type && file.type.startsWith("video/")) {
    return true;
  }

  const fileName = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
};

const VideoUploadDialog = () => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Add this
  const [downloadLink, setDownloadLink] = useState(null);

  // Use useCallback to ensure proper closure
  const checkIfReady = useCallback(async ({ s3Key }) => {
    try {
      const response = await fetch(`${API_URL}/upload-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: s3Key,
          operation: "get-audio",
        }),
      });

      const data = await response.json();

      if (response.status === 200 && data.presignedUrl) {
        setDownloadLink(data.presignedUrl);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error checking status:", err);
      return false;
    }
  }, []); // Empty deps since we only use setDownloadLink which is stable

  const handleFileChange = ({ target }) => {
    setError(null);
    const file = target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isVideoFile(file)) {
      setError("Please select a video file.");
      setSelectedFile(null);
      target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 1GB limit. Please select a smaller file.");
      setSelectedFile(null);
      target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setIsProcessing(true); // Start processing
    setDownloadLink(null);
    setError(null);

    try {
      const fileName = selectedFile.name;
      const fileExtension = fileName.split(".").pop();
      const timestamp = Date.now();
      const s3Key = `${timestamp}-${fileName}`;

      const reqUrl = `${API_URL}/upload-video`;
      const presignedUrlResponse = await fetch(reqUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucket: UPLOAD_BUCKET,
          key: s3Key,
          contentType: selectedFile.type || `video/${fileExtension}`,
        }),
      });

      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to get upload URL. Please try again.",
        );
      }

      const { presignedUrl } = await presignedUrlResponse.json();

      if (!presignedUrl) {
        throw new Error("Invalid response from server.");
      }

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || `video/${fileExtension}`,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3.");
      }

      // Trigger conversion Lambda
      const convertResponse = await fetch(`${API_URL}/upload-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: s3Key,
          operation: "trigger-conversion",
        }),
      });

      if (!convertResponse.ok) {
        throw new Error("Failed to start conversion.");
      }

      // Define checkIfReady inside handleUpload
      const checkIfReady = async ({ s3Key }) => {
        try {
          const response = await fetch(`${API_URL}/upload-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: s3Key,
              operation: "get-audio",
            }),
          });

          const data = await response.json();

          if (response.status === 200 && data.presignedUrl) {
            setDownloadLink(data.presignedUrl);
            setIsProcessing(false);
            toast.success("Your transcription is ready!"); // Add this line
            return true;
          }
          return false;
        } catch (err) {
          console.error("Error checking status:", err);
          return false;
        }
      };

      // Simple polling - check every 3 seconds, max 40 times (2 minutes)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        const ready = await checkIfReady({ s3Key });
        attempts++;

        if (ready) {
          clearInterval(pollInterval);
          setIsProcessing(false); // Stop processing on timeout
          return;
        }

        if (attempts >= 40) {
          clearInterval(pollInterval);
          setIsProcessing(false); // Stop processing on timeout
          setError(
            "Conversion is taking longer than expected. Please check back later.",
          );
        }
      }, 3000);

      setOpen(false);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
      setIsProcessing(false); // Stop processing on error
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={isProcessing}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Video
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Video</DialogTitle>
            <DialogDescription>
              Select a video file to upload. Maximum file size is 1GB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isUploading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Spinner className="h-5 w-5" />
                <span className="text-sm text-muted-foreground">
                  Uploading and processing video...
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="video-file">Video File</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*,.mkv,.m4v"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
            {selectedFile && (
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setSelectedFile(null);
                setError(null);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              variant="outline"
            >
              {isUploading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isProcessing && (
        <Button variant="outline" disabled>
          <Spinner className="mr-2 h-4 w-4" />
          Processing...
        </Button>
      )}
      {downloadLink && (
        <Button asChild variant="outline">
          <a
            href={downloadLink}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Audio
          </a>
        </Button>
      )}
    </div>
  );
};

export { VideoUploadDialog };
