import {createContext,useContext} from 'react';
export const RequestHostContext=createContext<string | null>(null);
export function useRequestHost(){const server=useContext(RequestHostContext);return server??(typeof window==='undefined'?null:window.location.hostname);}
