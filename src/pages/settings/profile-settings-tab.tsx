import { type FormEvent, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { ImageUploadField, uploadImage } from "@/components/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUser } from "@/store/slices/auth-slice";
import type { UserProfile } from "@/types/domain";
import { useImageDraft } from "./use-image-draft";

export function ProfileSettingsTab() {
  const { data: profile, mutate } = useSWR<UserProfile>("/api/me");

  if (!profile) return <p className="text-muted-foreground text-sm">Carregando…</p>;

  return <ProfileForm profile={profile} onSaved={(updated) => mutate(updated, { revalidate: false })} />;
}

function ProfileForm({ profile, onSaved }: { profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const image = useImageDraft(profile.imageUrl);

  const dirty = name.trim() !== profile.name || image.dirty;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const imageKey = await image.resolve((file) =>
        uploadImage((input) => api.post("/api/me/avatar/presign", input), file),
      );
      const updated = await api.put<UserProfile>("/api/me", { name: name.trim(), image: imageKey });
      onSaved(updated);
      image.reset();
      setName(updated.name);
      // O nome aparece no rodapé do menu lateral.
      if (authUser) dispatch(setUser({ ...authUser, name: updated.name }));
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <UserRound className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Meu perfil</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Seu nome e sua foto aparecem para as outras pessoas da empresa.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
          <ImageUploadField
            previewUrl={image.previewUrl}
            fallback={name.trim().charAt(0).toUpperCase() || "?"}
            disabled={saving}
            onSelect={(file) => {
              const error = image.select(file);
              if (error) toast.error(error);
            }}
            onRemove={image.remove}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input id="profile-email" value={profile.email} disabled />
          </div>
          <div>
            <Button type="submit" disabled={saving || !dirty || !name.trim()}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
