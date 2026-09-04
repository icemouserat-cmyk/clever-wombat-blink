import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentUrl: string | null;
  folder: string;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
  label?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const ImageUpload: React.FC<ImageUploadProps> = ({ currentUrl, folder, onUploaded, onRemoved, label }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a JPG, PNG, WEBP, or GIF image.' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum size is 5MB.' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('app-images')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('app-images').getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast({ title: 'Uploaded', description: 'Image uploaded successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div className="flex items-center gap-3">
        {currentUrl ? (
          <div className="relative">
            <img src={currentUrl} alt="" className="h-16 w-16 rounded-lg object-cover border" />
            <button
              type="button"
              onClick={onRemoved}
              className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow-sm hover:bg-slate-50"
            >
              <X className="h-3 w-3 text-destructive" />
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center bg-slate-50">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild disabled={isUploading}>
            <span className="flex items-center gap-2">
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {currentUrl ? 'Replace' : 'Upload'}
            </span>
          </Button>
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, or GIF. Max 5MB.</p>
    </div>
  );
};

export default ImageUpload;
