/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */

'use strict';

import { assert } from "hyperion-globals/src/assert";
import type { ALSurfaceMutationEventData } from "./ALSurfaceMutationPublisher";
import type { ALSurfaceVisibilityEventData } from "./ALSurfaceVisibilityPublisher";
import { type IALFlowlet } from "./ALFlowletManager";
import type { ALSurfaceCapability } from "./ALSurface";


export type ALSurfaceEvent = Readonly<{
  surface: string;
  surfaceData: ALSurfaceData;
}>;

abstract class ALSurfaceDataCore {
  private __ext: { [namespace: string]: any; };
  #locked: boolean = false; // allow removal by default

  readonly children: ALSurfaceData[] = [];

  constructor(
    public readonly surface: string | null,
    public readonly parent: ALSurfaceDataCore | null,
  ) {
    this.__ext = Object.create(this.parent?.__ext ?? null);
  }

  public isRemovable(): boolean {
    const isChildless = this.children.length === 0
    return isChildless && !this.#locked;
  }
  remove(): boolean {
    return this.isRemovable();
  }

  getInheritedPropery<T>(propName: string): T | undefined | null {
    return this.__ext[propName] as T;
  }

  setInheritedPropery<T>(propName: string, propValue: T): T {
    this.__ext[propName] = propValue;

    this.#locked = true; // now that this node has data, it should never be removed

    return propValue;
  }

}
class ALSurfaceDataRoot extends ALSurfaceDataCore {
  public readonly surface: null = null;
  public readonly parent: null = null;
  public readonly callFlowlet: null = null;
  public readonly capability: null = null;
  public readonly domAttributeName: null = null;
  public readonly domAttributeValue: null = null;
  public readonly nonInteractiveSurface: null = null;

  constructor() {
    super(null, null);
    assert(!ALSurfaceData.root, `There should be only one instance of root ALSurfaceData`);
  }

  public isRemovable(): boolean {
    return false;
  }
}

const surfacesData = new Map<string, ALSurfaceData>();
export class ALSurfaceData extends ALSurfaceDataCore {
  static root = new ALSurfaceDataRoot();

  static tryGet(surface: string): ALSurfaceData | null | undefined {
    return surfacesData.get(surface);
  }
  static get(surface: string): ALSurfaceData {
    let data = surfacesData.get(surface);
    assert(data != null, `Invalid situation! Surface ${surface} does not exits!`);
    // if (!data) {
    //   const parentNameLength = surface.lastIndexOf(SURFACE_SEPARATOR);
    //   let parentData: ALSurfaceData = ALSurfaceData.root;
    //   if (parentNameLength > 0) {
    //     let parentSurfaceName = surface.substring(0, parentNameLength);
    //     parentData = ALSurfaceData.get(parentSurfaceName);
    //   }
    //   data = new ALSurfaceData(surface, parentData);
    //   parentData.children.push(data);
    //   surfacesData.set(surface, data);
    // }
    return data;
  }

  #mutationEvent: ALSurfaceMutationEventData | null = null;
  #visibilityEvent: ALSurfaceVisibilityEventData | null = null;

  constructor(
    public readonly surface: string,
    public readonly parent: ALSurfaceData | ALSurfaceDataRoot,
    public readonly callFlowlet: IALFlowlet,
    public readonly capability: ALSurfaceCapability | null | undefined,
    public readonly domAttributeName: string,
    public readonly domAttributeValue: string,
    public readonly nonInteractiveSurface: string,
  ) {
    super(surface, parent);
    this.parent.children.push(this);
    if (__DEV__) {
      assert(
        !surfacesData.get(surface),
        `Surface ${surface} is already added to list`
      );
      assert(
        this.parent.surface === null || surfacesData.has(this.parent.surface),
        `Parent of surface ${surface} does not exist in the list`
      );
    }
    surfacesData.set(surface, this);
  }

  getMutationEvent(): ALSurfaceMutationEventData | null {
    return this.#mutationEvent;
  }
  setMutationEvent(event: ALSurfaceMutationEventData): ALSurfaceMutationEventData {
    if (event === null) {
      __DEV__ && assert(this.#mutationEvent?.event === "unmount_component", "Deactivating surface without unmouting it first");
      this.#visibilityEvent = null;
    }
    this.#mutationEvent = event;
    return event;
  }

  getVisibilityEvent(): ALSurfaceVisibilityEventData | null {
    return this.#visibilityEvent;
  }
  setVisibilityEvent(event: ALSurfaceVisibilityEventData): ALSurfaceVisibilityEventData {
    // return this.#visibilityEvent = event; // For now not keeping the event to see the impact on memory
    return event;
  }

  public isRemovable(): boolean {
    return super.isRemovable() && this.#mutationEvent === null && this.#visibilityEvent === null;
  }

  remove(): boolean {
    /**
     * While mount event happens bottom-up, the unmount event (may) happens top down.
     * We can remove the parent node once all its children are removed. Also, since the
     * application might have associated surface data, we would want to keep those surfaces
     * around. So, as soon as we reach a leaf node that has data, we should stop. 
     */
    // If this method is called explicitly, we are done with the surface and can remove it, so first cleanup state
    this.#mutationEvent = null;
    this.#visibilityEvent = null;
    
    return super.remove();
    
    if (!super.remove()) {
      return false;
    }

    if (this.parent) {
      const parentsChildren = this.parent.children;
      // Remove this from parent's children

      // The following is a fast remove
      const index = parentsChildren.indexOf(this);
      if (index > -1) {
        parentsChildren[index] = parentsChildren[parentsChildren.length - 1]; // move the last one to the found location
        parentsChildren.length -= 1;
        const canPropageUpwardRemove = this.parent.isRemovable();
        if (canPropageUpwardRemove) {
          this.parent.remove();
        }
      } else {
        __DEV__ && assert(index > -1, `Invalid situation! surface ${this.surface} should be child of ${this.parent.surface}`);
      }
    }

    surfacesData.delete(this.surface);
    return true;
  }


}
