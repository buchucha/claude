
import { supabase } from './supabaseClient';

/**
 * [IKAVA VetPulse - Centralized Image Upload Service]
 * Strategy: Always upload to Supabase Storage first.
 * A separate NAS scheduler will sync these files to local storage later.
 */
export const uploadImage = async (file: File, _serverUrl?: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    // Unique filename to prevent collisions during NAS sync
    const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `clinical_media/${safeFileName}`;

    const { data, error } = await supabase.storage
      .from('order_images') 
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('order_images')
      .getPublicUrl(filePath);

    console.log("Supabase Upload Success:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Critical: Supabase Storage upload failed.", err);
    return null;
  }
};
