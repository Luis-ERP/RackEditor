'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listProjects,
  createProject as registryCreate,
  updateProject as registryUpdate,
  deleteProject as registryDelete,
} from './projectRegistry.js';

const REGISTRY_KEY = 'rack-editor:projects-registry';

export default function useProjectRegistry() {
  const [projects, setProjects] = useState(() => listProjects());

  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || e.key === REGISTRY_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const createProject = useCallback((name) => {
    const project = registryCreate(name);
    refresh();
    return project;
  }, [refresh]);

  const updateProject = useCallback((id, fields) => {
    const project = registryUpdate(id, fields);
    refresh();
    return project;
  }, [refresh]);

  const deleteProject = useCallback((id) => {
    registryDelete(id);
    refresh();
  }, [refresh]);

  return { projects, createProject, updateProject, deleteProject };
}
