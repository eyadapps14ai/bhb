// The user this dashboard page was loaded for. Writes send it as X-BHB-User, so the server refuses them when this
// browser has since signed in as someone else (in another tab) instead of saving under the wrong person.
let current='';
export const setPageUser=(id:string)=>{current=id};
export const userHeader=():Record<string,string>=>current?{'X-BHB-User':current}:{};
