import { configureStore } from "@reduxjs/toolkit";
import { pvApi } from "./services/pvApi";

export const store = configureStore({
  reducer: {
    [pvApi.reducerPath]: pvApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(pvApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

