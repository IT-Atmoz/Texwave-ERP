import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, get } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, FileText, Image, ExternalLink } from 'lucide-react';

interface DocumentItem {
  label: string;
  key: string;
  url: string;
  isImage: boolean;
}

const DOC_FIELDS: { label: string; key: string; isImage: boolean }[] = [
  { label: 'Profile Photo', key: 'profilePhoto', isImage: true },
  { label: 'Resume', key: 'resumeUrl', isImage: false },
  { label: 'Aadhaar Card', key: 'aadhaarUrl', isImage: false },
  { label: 'PAN Card', key: 'panUrl', isImage: false },
  { label: 'Bank Statement', key: 'bankStatementUrl', isImage: false },
  { label: '10th Certificate', key: 'tenthCertificateUrl', isImage: false },
  { label: '12th Certificate', key: 'twelfthCertificateUrl', isImage: false },
  { label: 'Graduation Certificate', key: 'graduationCertificateUrl', isImage: false },
  { label: 'Post Graduation Certificate', key: 'postGraduationCertificateUrl', isImage: false },
];

export default function MyDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employeeId) return;
    const load = async () => {
      const snap = await get(ref(database, `hr/employees/${user.employeeId}`));
      if (snap.exists()) {
        const data = snap.val();
        const docs: DocumentItem[] = DOC_FIELDS
          .filter((f) => data[f.key])
          .map((f) => ({ label: f.label, key: f.key, url: data[f.key], isImage: f.isImage }));
        setDocuments(docs);
      }
      setLoading(false);
    };
    load();
  }, [user?.employeeId]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading documents...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">My Documents</h1>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <FolderOpen className="h-14 w-14 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No documents uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">Ask your HR admin to upload your documents</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{documents.length} document{documents.length !== 1 ? 's' : ''} available</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {documents.map((doc) => (
              <div key={doc.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {doc.isImage ? (
                      <Image className="h-5 w-5 text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <p className="font-medium text-sm text-foreground">{doc.label}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(doc.url, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
