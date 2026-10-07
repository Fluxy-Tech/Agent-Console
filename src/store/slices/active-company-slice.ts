import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MemberRole, PermissionAction } from "../../domain/permission-action";

export interface ActiveCompany {
  id: string;
  name: string;
  memberRole: MemberRole | null;
  /// Telas personalizadas na tela de Acessos (null = padrão do papel).
  memberPermissions?: PermissionAction[] | null;
  /// Empresa "Suporte Sturnus" — o Console vira só a central de suporte
  /// (menu reduzido, tela inicial /support). Opcional por causa do cache
  /// persistido de versões antigas.
  isSupportHub?: boolean;
}

/// Tela inicial da empresa ativa: a central de suporte abre no dashboard do
/// time de suporte; as demais, em Contatos.
export function homePathFor(company: ActiveCompany | null): string {
  return company?.isSupportHub ? "/support/dashboard" : "/targets";
}

const initialState: ActiveCompany | null = null;

const activeCompanySlice = createSlice({
  name: "activeCompany",
  initialState: initialState as ActiveCompany | null,
  reducers: {
    setActiveCompany(_state, action: PayloadAction<ActiveCompany | null>) {
      return action.payload;
    },
  },
});

export const { setActiveCompany } = activeCompanySlice.actions;
export const activeCompanyReducer = activeCompanySlice.reducer;
