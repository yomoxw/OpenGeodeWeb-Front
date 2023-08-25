import { defineStore } from 'pinia'
import _ from 'lodash'

import vtkWSLinkClient from '@kitware/vtk.js/IO/Core/WSLinkClient'
import SmartConnect from 'wslink/src/SmartConnect'

import '@kitware/vtk.js/Rendering/OpenGL/Profiles/Geometry'
import { connectImageStream } from '@kitware/vtk.js/Rendering/Misc/RemoteView'
import protocols from '@/protocols'

// Bind vtkWSLinkClient to our SmartConnect
vtkWSLinkClient.setSmartConnectClass(SmartConnect);


export const use_websocket_store = defineStore('websocket', {
  state: () => ({
    client: {},
    config: null,
    busy: false,
    is_client_created: false
  }),
  actions: {
    ws_connect () {
      const config = { application: 'cone' };
      const cloud_store = use_cloud_store()
      config.sessionURL = cloud_store.viewer_url

      const { client } = this
      if (this.is_client_created && client.isConnected()) {
        client.disconnect(-1);
        this.is_client_created = false;
      }
      let clientToConnect = client;
      if (_.isEmpty(clientToConnect)) {
        clientToConnect = vtkWSLinkClient.newInstance({ protocols });
      }

      // Connect to busy store
      clientToConnect.onBusyChange((count) => {
        this.buzy = count
      });
      clientToConnect.beginBusy();

      // Error
      clientToConnect.onConnectionError((httpReq) => {
        const message =
          (httpReq && httpReq.response && httpReq.response.error) ||
          `Connection error`;
        console.error(message);
        console.log(httpReq);
      });

      // Close
      clientToConnect.onConnectionClose((httpReq) => {
        const message =
          (httpReq && httpReq.response && httpReq.response.error) ||
          `Connection close`;
        console.error(message);
        console.log(httpReq);
      });

      // Connect
      clientToConnect
        .connect(config)
        .then((validClient) => {
          connectImageStream(validClient.getConnection().getSession());
          this.client = validClient
          clientToConnect.endBusy();

          // Now that the client is ready let's setup the server for us
          this.ws_initialize_server()
          this.client.getRemote().vtk.reset().catch(console.error);
          this.is_client_created = true;
        })
        .catch((error) => {
          console.error(error);
        });
    },
    ws_initialize_server () {

      if (!_.isEmpty(this.client)) {
        this.client
          .getRemote()
          .vtk.create_visualization()
          .catch(console.error);
      }
    },
    reset_camera () {
      if (!_.isEmpty(this.client)) {
        this.client.getRemote().vtk.reset_camera().catch(console.error);
      }
    },
  },
})