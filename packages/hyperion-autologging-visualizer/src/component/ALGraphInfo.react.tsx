/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */
import * as AutoLogging from "@hyperion/hyperion-autologging/src/AutoLogging";
import { PausableChannel } from "@hyperion/hyperion-channel";
import cytoscape from 'cytoscape';
import React, { useState } from "react";
import * as ALGraph from "./ALGraph";

export function ALGraphInfo(): React.JSX.Element {
  /**
   * NOTE: Using the CytoscapeComponent did not work for this approach that
   * uses a dynamic approach to update the graph. That component seems to
   * keep changing the instance of the graph behind the scene
   */

  const container = React.useRef<HTMLDivElement>(null);
  const graphRef = React.useRef<{
    graph: ALGraph.ALGraph,
    channel: PausableChannel<AutoLogging.ALChannelEvent>,
  } | null>(null);

  const [elements, _setElements] = useState<cytoscape.ElementDefinition[]>([
    // Add any initial notes to the graph here
  ]);

  React.useEffect(
    () => {
      if (graphRef.current == null) {
        const cy = cytoscape({
          container: container.current,
          elements,
        });
        const graph = new ALGraph.ALGraph(cy);
        const channel = new PausableChannel<AutoLogging.ALChannelEvent>();
        graphRef.current = { graph, channel };

        AutoLogging.getInitOptions().channel.pipe(channel);

        cy.on('click mouseover', 'node', (event) => {
          console.log('[PS]', event.type, event.target.data(), event.target.scratch());
        });
        cy.on('click', 'edge', (event) => {
          console.log('[PS]', event.type, event.target.data(), event.target.scratch());
        });

        const alEvents = ALGraph.SupportedALEvents;

        alEvents.forEach(eventName => {
          switch (eventName) {
            case 'al_ui_event':
              channel.on(eventName).add(eventData => {
                graph.addALUIEventNodeId(eventName, eventData);
              });
              break;
            case 'al_surface_mutation_event':
              channel.on(eventName).add(eventData => {
                graph.addSurfaceEvent(eventName, eventData);
              });
              break;
            default:
              channel.on(eventName).add(eventData => {
                graph.addALEventNodeId(eventName, eventData);
              });
              break;
          }
        });
      }

      graphRef.current?.channel.unpause();
      return () => graphRef.current?.channel.pause();
    },
    [graphRef]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "1000px",
        textAlign: "left",
        display: "inline-block",
        borderBlockStyle: 'groove',
        borderBlockColor: 'red'
      }}
      ref={container}></div>
  );
}