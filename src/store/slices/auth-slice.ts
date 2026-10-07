import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  /// User.role === "support" — time de suporte técnico: só a tela de Suporte
  /// técnico (chamados de todas as empresas). Opcional por causa do cache
  /// persistido de versões antigas.
  isSupportAgent?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  /// "idle" = ainda não checamos a sessão nesta carga da página. A store
  /// persistida é só cache de UI — GET /api/auth/get-session é sempre a fonte
  /// de verdade, revalidada no boot (ver useBootstrapSession).
  status: "idle" | "loading" | "ready";
}

const initialState: AuthState = { user: null, status: "idle" };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.status = "ready";
    },
    setLoading(state) {
      state.status = "loading";
    },
    clearAuth(state) {
      state.user = null;
      state.status = "ready";
    },
  },
});

export const { setUser, setLoading, clearAuth } = authSlice.actions;
export const authReducer = authSlice.reducer;
