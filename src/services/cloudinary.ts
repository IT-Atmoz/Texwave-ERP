const CLOUDINARY_CLOUD_NAME = 'dpgf1rkjl';
const CLOUDINARY_UPLOAD_PRESET = 'unsigned_preset';

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Image upload failed');
  }

  const data = await response.json();
  return data.secure_url;
};

export const uploadPDF = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('PDF upload failed');
  }

  const data = await response.json();
  return data.secure_url;
};

export const uploadFile = async (file: File): Promise<string> => {
  if (file.type.startsWith('image/')) {
    return uploadImage(file);
  } else {
    return uploadPDF(file);
  }
};
