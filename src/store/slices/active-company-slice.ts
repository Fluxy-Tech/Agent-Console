import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MemberRole, PermissionAction } from "../../domain/permission-action";

export interface ActiveCompany {
  id: string;
  name: string;
  memberRole: MemberRole | null;
  /// Telas personalizadas na tela de Acessos (null = padrão do papel).
  memberPermissions?: PermissionAction[] | null;
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
